import { useSettings } from '@/store/settings/selectors.ts';
import { CheckCircle, RadioButtonUnchecked } from '@mui/icons-material';
import {
  Box,
  Fade,
  Unstable_Grid2 as Grid,
  IconButton,
  ImageListItem,
  ImageListItemBar,
  Skeleton,
  alpha,
  useTheme,
} from '@mui/material';
import { createExternalId } from '@tunarr/shared';
import {
  PlexChildMediaApiType,
  PlexMedia,
  isPlexPlaylist,
  isTerminalItem,
} from '@tunarr/types/plex';
import { filter, isNaN, isNil, isUndefined } from 'lodash-es';
import pluralize from 'pluralize';
import React, {
  ForwardedRef,
  MouseEvent,
  forwardRef,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useIntersectionObserver } from 'usehooks-ts';
import {
  forPlexMedia,
  isNonEmptyString,
  prettyItemDuration,
  toggle,
} from '../../helpers/util.ts';
import { usePlexTyped } from '../../hooks/plex/usePlex.ts';
import useStore from '../../store/index.ts';
import {
  addKnownMediaForServer,
  addPlexSelectedMedia,
  removePlexSelectedMedia,
} from '../../store/programmingSelector/actions.ts';
import { PlexSelectedMedia } from '../../store/programmingSelector/store.ts';

export interface PlexGridItemProps<T extends PlexMedia> {
  item: T;
  style?: React.CSSProperties;
  index?: number;
  parent?: string;
  moveModal?: (index: number, item: T) => void;
  modalIndex?: number;
  onClick?: () => void;
  ref?: React.RefObject<HTMLDivElement>;
}

const genPlexChildPath = forPlexMedia({
  collection: (collection) =>
    `/library/collections/${collection.ratingKey}/children`,
  playlist: (playlist) => `/playlists/${playlist.ratingKey}/items`,
  default: (item) => `/library/metadata/${item.ratingKey}/children`,
});

const extractChildCount = forPlexMedia({
  season: (s) => s.leafCount,
  show: (s) => s.childCount,
  collection: (s) => parseInt(s.childCount),
  playlist: (s) => s.leafCount,
});

const childItemType = forPlexMedia({
  season: 'episode',
  show: 'season',
  collection: (coll) => (coll.subtype === 'movie' ? 'movie' : 'show'),
  playlist: (pl) => (pl.playlistType === 'audio' ? 'track' : 'video'),
  artist: 'album',
  album: 'track',
});

const subtitle = forPlexMedia({
  movie: (item) => <span>{prettyItemDuration(item.duration)}</span>,
  default: (item) => {
    const childCount = extractChildCount(item);
    if (isNil(childCount)) {
      return null;
    }

    return (
      <span>{`${childCount} ${pluralize(
        childItemType(item) ?? 'item',
        childCount,
      )}`}</span>
    );
  },
});

export const PlexGridItem = forwardRef(
  <T extends PlexMedia>(
    props: PlexGridItemProps<T>,
    ref: ForwardedRef<HTMLDivElement>,
  ) => {
    const settings = useSettings();
    const theme = useTheme();
    const skeletonBgColor = alpha(
      theme.palette.text.primary,
      theme.palette.mode === 'light' ? 0.11 : 0.13,
    );
    const server = useStore((s) => s.currentServer!); // We have to have a server at this point
    const darkMode = useStore((state) => state.theme.darkMode);
    const [open, setOpen] = useState(false);
    const { item, index, style, moveModal } = props;
    const hasThumb = isNonEmptyString(
      isPlexPlaylist(props.item) ? props.item.composite : props.item.thumb,
    );
    const [imageLoaded, setImageLoaded] = useState(!hasThumb);
    const hasChildren = !isTerminalItem(item);
    const { data: children } = usePlexTyped<PlexChildMediaApiType<T>>(
      server.name,
      genPlexChildPath(props.item),
      hasChildren && open,
    );
    const selectedServer = useStore((s) => s.currentServer);
    const selectedMedia = useStore((s) =>
      filter(s.selectedMedia, (p): p is PlexSelectedMedia => p.type === 'plex'),
    );
    const selectedMediaIds = selectedMedia.map((item) => item.guid);

    const handleClick = () => {
      setOpen(toggle);

      if (!isUndefined(index) && !isUndefined(moveModal)) {
        moveModal(index, item);
      }
    };

    useEffect(() => {
      if (!isUndefined(children?.Metadata)) {
        addKnownMediaForServer(server.name, children.Metadata, item.guid);
      }
    }, [item.guid, server.name, children]);

    const handleItem = useCallback(
      (e: MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
        e.stopPropagation();

        if (selectedMediaIds.includes(item.guid)) {
          removePlexSelectedMedia(selectedServer!.name, [item.guid]);
        } else {
          addPlexSelectedMedia(selectedServer!.name, [item]);
        }
      },
      [item, selectedServer, selectedMediaIds],
    );

    const { isIntersecting: isInViewport, ref: imageContainerRef } =
      useIntersectionObserver({
        threshold: 0,
        rootMargin: '0px',
        freezeOnceVisible: true,
      });

    const extractChildCount = forPlexMedia({
      season: (s) => s.leafCount,
      show: (s) => s.childCount,
      collection: (s) => parseInt(s.childCount),
    });

    let childCount = isUndefined(item) ? null : extractChildCount(item);
    if (isNaN(childCount)) {
      childCount = null;
    }

    const isMusicItem = ['artist', 'album', 'track', 'playlist'].includes(
      item.type,
    );

    const isEpisodeItem = ['episode'].includes(item.type);

    let thumbSrc: string;
    if (isPlexPlaylist(item)) {
      thumbSrc = `${server.uri}${item.composite}?X-Plex-Token=${server.accessToken}`;
    } else {
      const query = new URLSearchParams({
        mode: 'proxy',
        asset: 'thumb',
        id: createExternalId('plex', server.name, item.ratingKey),
        // Commenting this out for now as temporary solution for image loading issue
        // thumbOptions: JSON.stringify({ width: 480, height: 720 }),
      });

      thumbSrc = `${
        settings.backendUri
      }/api/metadata/external?${query.toString()}`;
    }

    return (
      <Fade
        in={isInViewport && !isUndefined(item) && hasThumb === imageLoaded}
        timeout={750}
        ref={imageContainerRef}
      >
        <div>
          <ImageListItem
            component={Grid}
            key={item.guid}
            sx={{
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              paddingLeft: '8px !important',
              paddingRight: '8px',
              paddingTop: '8px',
              height: 'auto',
              backgroundColor: (theme) =>
                props.modalIndex === props.index
                  ? darkMode
                    ? theme.palette.grey[800]
                    : theme.palette.grey[400]
                  : 'transparent',
              ...style,
            }}
            onClick={
              hasChildren
                ? handleClick
                : (event: MouseEvent<HTMLDivElement>) => handleItem(event)
            }
            ref={ref}
          >
            {isInViewport && // TODO: Eventually turn this into isNearViewport so images load before they hit the viewport
              (hasThumb ? (
                <Box
                  sx={{
                    position: 'relative',
                    minHeight: isMusicItem ? 100 : isEpisodeItem ? 84 : 225, // 84 accomodates episode img height
                    maxHeight: '100%',
                  }}
                >
                  <img
                    src={thumbSrc}
                    style={{
                      borderRadius: '5%',
                      height: 'auto',
                      width: '100%',
                      visibility: imageLoaded ? 'visible' : 'hidden',
                      zIndex: 2,
                    }}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageLoaded(true)}
                  />
                  <Box
                    component="div"
                    sx={{
                      background: skeletonBgColor,
                      borderRadius: '5%',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      aspectRatio: isMusicItem
                        ? '1/1'
                        : isEpisodeItem
                        ? '1.77/1'
                        : '2/3',
                      width: '100%',
                      height: 'auto',
                      zIndex: 1,
                      opacity: imageLoaded ? 0 : 1,
                      visibility: imageLoaded ? 'hidden' : 'visible',
                      minHeight: isMusicItem ? 100 : isEpisodeItem ? 84 : 225,
                    }}
                  ></Box>
                </Box>
              ) : (
                <Skeleton
                  animation={false}
                  variant="rounded"
                  sx={{ borderRadius: '5%' }}
                  height={isMusicItem ? 144 : isEpisodeItem ? 84 : 250}
                />
              ))}
            <ImageListItemBar
              title={item.title}
              subtitle={subtitle(item)}
              position="below"
              actionIcon={
                <IconButton
                  aria-label={`star ${item.title}`}
                  onClick={(event: MouseEvent<HTMLButtonElement>) =>
                    handleItem(event)
                  }
                >
                  {selectedMediaIds.includes(item.guid) ? (
                    <CheckCircle />
                  ) : (
                    <RadioButtonUnchecked />
                  )}
                </IconButton>
              }
              actionPosition="right"
            />
          </ImageListItem>
        </div>
      </Fade>
    );
  },
);
