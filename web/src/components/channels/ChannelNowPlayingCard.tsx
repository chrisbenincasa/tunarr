import { Trans } from '@lingui/react/macro';
import { ZoomIn } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Link,
  Skeleton,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { getApiChannelsByIdNowPlayingQueryKey } from '@/generated/@tanstack/react-query.gen.ts';
import type { TvGuideProgram } from '@tunarr/types';
import * as globalDayjs from 'dayjs';
import { capitalize, isNil } from 'lodash-es';
import { useEffect, useState } from 'react';
import { match, P } from 'ts-pattern';
import { useInterval, useToggle } from 'usehooks-ts';
import {
  channelFlexImageUrl,
  nowPlayingImageUrl,
} from '../../helpers/nowPlayingImage.ts';
import {
  markReady,
  nowPlayingRefreshDelayMs,
  pruneHiddenLayers,
  pushProgram,
  visibleLayerIndex,
  type NowPlayingLayer as Layer,
} from '../../helpers/nowPlayingLayers.ts';
import { extractProgramGrandparent } from '../../helpers/programUtil.ts';
import { useChannelSuspense } from '../../hooks/useChannels.ts';
import { useDayjs } from '../../hooks/useDayjs.ts';
import { useChannelNowPlaying } from '../../hooks/useTvGuide.ts';
import { useSettings } from '../../store/settings/selectors.ts';
import ProgramDetailsDialog from '../programs/ProgramDetailsDialog.tsx';
import { NetworkIcon } from '../util/NetworkIcon.tsx';

const CrossFadeMs = 800;

type Props = {
  channelId: string;
};

type ProgramDetails = {
  title: string;
  showTitle?: string;
  seasonAndEpisode?: {
    episode: number;
    season: number;
  };
};

function programDetails(program: TvGuideProgram): ProgramDetails {
  return match(program)
    .returnType<ProgramDetails>()
    .with(
      { type: 'content', program: { type: P.union('episode', 'track') } },
      ({ program: c }) => {
        const grandparent = extractProgramGrandparent(c);
        const programIndex =
          c.type === 'episode' ? c.episodeNumber : c.trackNumber;
        const parentIndex =
          c.type === 'episode' ? c.season?.index : c.album?.index;

        return {
          title: c.title,
          showTitle: grandparent?.title,
          seasonAndEpisode:
            !isNil(programIndex) && !isNil(parentIndex)
              ? {
                  season: parentIndex,
                  episode: programIndex,
                }
              : undefined,
        };
      },
    )
    .with({ type: 'content' }, ({ program: c }) => ({ title: c.title }))
    .with({ type: 'custom' }, ({ program: c }) => ({
      title: c?.program?.title ?? `Custom`,
    }))
    .with({ type: 'flex' }, () => ({ title: 'Flex' }))
    .with({ type: 'redirect' }, (c) => ({
      title: `Redirect to ${c.channelNumber}`,
    }))
    .exhaustive();
}

export const ChannelNowPlayingCard = ({ channelId }: Props) => {
  const { data: channel } = useChannelSuspense(channelId);
  const { data: nowPlaying, dataUpdatedAt } = useChannelNowPlaying(channelId);
  const queryClient = useQueryClient();

  // Refetch just after the current program ends. Keying on dataUpdatedAt
  // reschedules after a refetch that still returns the ended program.
  useEffect(() => {
    const timer = setTimeout(
      () => {
        queryClient
          .invalidateQueries({
            queryKey: getApiChannelsByIdNowPlayingQueryKey({
              path: { id: channelId },
            }),
          })
          .catch(console.error);
      },
      nowPlayingRefreshDelayMs(nowPlaying.stop, Date.now()),
    );
    return () => clearTimeout(timer);
  }, [channelId, dataUpdatedAt, nowPlaying.stop, queryClient]);

  // Re-renders the start and remaining times.
  const [now, setNow] = useState(Date.now);
  useInterval(() => setNow(Date.now()), 30_000);

  const [layers, setLayers] = useState<Layer[]>(() => [
    { program: nowPlaying, ready: false },
  ]);
  const nextLayers = pushProgram(layers, nowPlaying);
  if (nextLayers !== layers) {
    setLayers(nextLayers);
    setNow(Date.now());
  }

  const visibleIndex = visibleLayerIndex(layers);

  // Old layers stay mounted until the new one has faded in over them.
  useEffect(() => {
    if (visibleIndex <= 0) {
      return;
    }
    const timer = setTimeout(
      () => setLayers((current) => pruneHiddenLayers(current)),
      CrossFadeMs,
    );
    return () => clearTimeout(timer);
  }, [visibleIndex]);

  return (
    <Card sx={{ width: '100%', display: 'grid' }}>
      {layers.map((layer, index) => {
        const visible = index === visibleIndex;
        return (
          <Box
            key={`${layer.program.start}-${layer.program.stop}`}
            aria-hidden={!visible}
            sx={(theme) => ({
              gridArea: '1 / 1',
              display: 'flex',
              flexDirection: ['column', 'row'],
              opacity: visible ? 1 : 0,
              pointerEvents: visible ? 'auto' : 'none',
              transition: theme.transitions.create('opacity', {
                duration: CrossFadeMs,
              }),
            })}
          >
            <NowPlayingLayer
              program={layer.program}
              flexPicture={channel.offline.picture}
              showSkeleton={visible && !layer.ready}
              now={now}
              onReady={() =>
                setLayers((current) => markReady(current, layer.program))
              }
            />
          </Box>
        );
      })}
    </Card>
  );
};

type LayerProps = {
  program: TvGuideProgram;
  flexPicture: string | undefined;
  showSkeleton: boolean;
  now: number;
  onReady: () => void;
};

const NowPlayingLayer = ({
  program,
  flexPicture,
  showSkeleton,
  now,
  onReady,
}: LayerProps) => {
  const dayjs = useDayjs();
  const { backendUri } = useSettings();
  const [open, toggleOpen] = useToggle(false);

  const details = programDetails(program);
  const flexImageUrl = channelFlexImageUrl(flexPicture, backendUri);
  const artworkUrl = nowPlayingImageUrl(program, flexPicture, backendUri);

  // Artwork that fails to load falls back to the flex image.
  const [artworkFailed, setArtworkFailed] = useState(false);
  const imageUrl = artworkFailed ? flexImageUrl : artworkUrl;
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
    onReady();
  };

  const handleImageError = () => {
    console.error(`Failed to load image: ${imageUrl}`);
    if (imageUrl === flexImageUrl) {
      setImageLoaded(true);
      onReady();
    } else {
      setArtworkFailed(true);
    }
  };

  const startedAgo = dayjs(program.start).from(now);
  const remainingTime =
    globalDayjs.duration(Math.max(program.stop - now, 0)).humanize() + ' ';

  return (
    <>
      <CardMedia
        component="img"
        image={imageUrl}
        alt={details.title}
        title={details.title}
        onLoad={handleImageLoad}
        onError={handleImageError}
        sx={{
          display: showSkeleton && !imageLoaded ? 'none' : 'block',
          height: 350,
          width: ['100%', '75%'],
          flexShrink: 0,
          objectFit: 'cover',
        }}
      />

      {showSkeleton && !imageLoaded && (
        <Skeleton
          component="div"
          variant="rectangular"
          height={350}
          animation="wave"
          sx={{
            minHeight: 350,
            width: ['100%', '75%'],
            flexShrink: 0,
          }}
        />
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0,
        }}
      >
        <CardContent sx={{ flex: 1 }}>
          <Typography gutterBottom variant="h4">
            <Trans>Now Playing:</Trans>
          </Typography>
          <Typography gutterBottom variant="h5" component="div">
            {details.showTitle ?? details.title}
          </Typography>
          {details.showTitle && <Typography>{details.title}</Typography>}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            <Trans>
              Started {startedAgo} - {remainingTime}
              remaining
            </Trans>
          </Typography>
        </CardContent>
        <CardActions>
          <Button startIcon={<ZoomIn />} size="small" onClick={toggleOpen}>
            <Trans>Details</Trans>
          </Button>

          {program.type === 'content' &&
            program.program.sourceType !== 'local' && (
              <Button
                startIcon={
                  <NetworkIcon
                    network={program.program.sourceType}
                    width={15}
                    height={15}
                  />
                }
                size="small"
                component={Link}
                href={`${backendUri}/api/programs/${program.id}/external-link`}
                target="_blank"
              >
                <Trans>View in {capitalize(program.program.sourceType)}</Trans>
              </Button>
            )}
        </CardActions>
      </Box>
      {program.type === 'content' && (
        <ProgramDetailsDialog
          open={open}
          programId={program.id}
          programType={program.program.type}
          onClose={toggleOpen}
          start={dayjs(program.start)}
          stop={dayjs(program.stop)}
        />
      )}
    </>
  );
};
