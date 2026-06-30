import { Trans } from '@lingui/react/macro';
import { ZoomIn } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Fade,
  Link,
  Skeleton,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import type { MediaArtwork } from '@tunarr/types';
import * as globalDayjs from 'dayjs';
import { capitalize, isNil } from 'lodash-es';
import { useMemo, useState } from 'react';
import { match, P } from 'ts-pattern';
import { useTimeout, useToggle } from 'usehooks-ts';
import { extractProgramGrandparent } from '../../helpers/programUtil.ts';
import { useChannelAndProgramming } from '../../hooks/useChannelLineup.ts';
import { useDayjs } from '../../hooks/useDayjs.ts';
import { useChannelNowPlaying } from '../../hooks/useTvGuide.ts';
import { useSettings } from '../../store/settings/selectors.ts';
import ProgramDetailsDialog from '../programs/ProgramDetailsDialog.tsx';
import { NetworkIcon } from '../util/NetworkIcon.tsx';

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

export const ChannelNowPlayingCard = ({ channelId }: Props) => {
  const dayjs = useDayjs();
  const { backendUri } = useSettings();

  const {
    data: { lineup },
  } = useChannelAndProgramming(channelId);
  const { data: firstProgram } = useChannelNowPlaying(channelId);
  const [open, toggleOpen] = useToggle(false);

  const queryClient = useQueryClient();

  useTimeout(() => {
    queryClient
      .invalidateQueries({
        queryKey: ['channels', channelId, 'now_playing'],
      })
      .catch(console.error);
  }, firstProgram.stop + 5_000);

  const details = useMemo(() => {
    return match(firstProgram)
      .returnType<ProgramDetails | null>()
      .with(P.nullish, () => null)
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
  }, [firstProgram]);

  const imageUrl = useMemo(() => {
    if (!firstProgram) {
      return;
    }

    if (firstProgram.type !== 'content') {
      return;
    }

    const program = lineup.programs[firstProgram.id];
    if (!program) {
      return;
    }

    const [id, artworkType, fallbackTypes] = match([
      program.program,
      extractProgramGrandparent(program.program),
    ])
      .returnType<[string, MediaArtwork['type'], MediaArtwork['type'][]]>()
      .with([{ type: 'episode' }, P.nonNullable], ([_, show]) => [
        show.uuid,
        'fanart',
        ['poster'],
      ])
      .with([{ type: 'episode' }, P._], ([ep, _]) => [ep.uuid, 'thumbnail', []])
      .with([{ type: 'track' }, P.nonNullable], ([_, artist]) => [
        artist.uuid,
        'banner',
        ['fanart', 'poster'],
      ])
      .with([{ type: 'movie' }, P._], ([movie, _]) => [
        movie.uuid,
        'banner',
        ['fanart', 'poster'],
      ])
      .otherwise(([other, _]) => [other.uuid, 'fanart', ['poster']]);

    const fallbackParts =
      fallbackTypes.length === 0 ? '' : `${fallbackTypes.join(',')}`;

    return `${backendUri}/api/programs/${id}/artwork/${artworkType}?fallbackArtworkTypes=${fallbackParts}`;
  }, [backendUri, firstProgram, lineup.programs]);

  const [imageLoaded, setImageLoaded] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    console.error(`Failed to load image: ${imageUrl}`);
    setImageLoaded(true);
  };

  const startedAgo = dayjs(firstProgram?.start).fromNow();
  const remainingTime =
    globalDayjs
      .duration(dayjs(firstProgram?.stop ?? 0).diff(dayjs()))
      .humanize() + ' ';

  return (
    <Card
      sx={{
        display: 'flex',
        width: '100%',
        position: 'relative',
        flexDirection: ['column', 'row'],
      }}
    >
      <Fade in={imageLoaded}>
        <CardMedia
          component="img"
          image={imageUrl}
          alt={details?.title}
          title={details?.title}
          onLoad={handleImageLoad}
          onError={handleImageError}
          sx={{
            display: imageLoaded ? 'block' : 'none',
            height: 350,
            width: ['100%', '75%'],
            objectFit: 'cover',
          }}
        />
      </Fade>

      {!imageLoaded && (
        <Skeleton
          component="div"
          variant="rectangular"
          height={350}
          animation="wave"
          sx={{
            minHeight: 350,
            width: ['100%', '75%'],
            zIndex: 1,
          }}
        />
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <CardContent sx={{ flex: 1 }}>
          <Typography gutterBottom variant="h4">
            <Trans>Now Playing:</Trans>
          </Typography>
          <Typography gutterBottom variant="h5" component="div">
            {details?.showTitle ?? details?.title}
          </Typography>
          {details?.showTitle && <Typography>{details.title}</Typography>}
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

          {firstProgram?.type === 'content' &&
            firstProgram?.program.sourceType !== 'local' && (
              <Button
                startIcon={
                  <NetworkIcon
                    network={firstProgram.program.sourceType}
                    width={15}
                    height={15}
                  />
                }
                size="small"
                component={Link}
                href={`${backendUri}/api/programs/${firstProgram.id}/external-link`}
                target="_blank"
              >
                <Trans>
                  View in {capitalize(firstProgram.program.sourceType)}
                </Trans>
              </Button>
            )}
        </CardActions>
      </Box>
      {firstProgram.type === 'content' && (
        <ProgramDetailsDialog
          open={open}
          programId={firstProgram.id}
          programType={firstProgram.program.type}
          onClose={toggleOpen}
          start={dayjs(firstProgram.start)}
          stop={dayjs(firstProgram.stop)}
        />
      )}
    </Card>
  );
};
