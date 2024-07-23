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
import { PlexMedia } from '@tunarr/types/plex';
import { filter, isNaN, isUndefined } from 'lodash-es';
import React, { ForwardedRef, MouseEvent, useCallback, useState } from 'react';
import { useIntersectionObserver } from 'usehooks-ts';
import { toggle } from '../../helpers/util.ts';
import useStore from '../../store/index.ts';
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

type Extractors<T> = {
  id: (item: T) => string;
  isPlaylist: (item: T) => boolean;
  hasThumbnail: (item: T) => boolean;
  childCount: (item: T) => number | null;
  isMusicItem: (item: T) => boolean;
  isEpisode: (item: T) => boolean;
  title: (item: T) => string;
  subtitle: (item: T) => JSX.Element | string | null;
  thumbnailUrl: (item: T) => string;
};

type Props<T> = {
  item: T;
  extractors: Extractors<T>;
  style?: React.CSSProperties;
  index?: number;
  moveModal?: (index: number, item: T) => void;
  modalIndex?: number;
  ref?: React.RefObject<HTMLDivElement>;
  onClick: (item: T) => void;
  onSelect: (item: T) => void;
  imgListItemRef: ForwardedRef<HTMLDivElement>;
};

export function MediaGridItem<T>(props: Props<T>) {
  // const settings = useSettings();
  const theme = useTheme();
  const skeletonBgColor = alpha(
    theme.palette.text.primary,
    theme.palette.mode === 'light' ? 0.11 : 0.13,
  );
  // const server = useCurrentMediaSource('plex')!; // We have to have a server at this point
  const darkMode = useStore((state) => state.theme.darkMode);
  const [open, setOpen] = useState(false);
  const { item, extractors, index, style, moveModal } = props;
  const hasThumb = extractors.hasThumbnail(item);
  const [imageLoaded, setImageLoaded] = useState(!hasThumb);
  // const hasChildren = !isTerminalItem(item);
  // const { data: children } = usePlexTyped<PlexChildMediaApiType<T>>(
  //   server.name,
  //   genPlexChildPath(props.item),
  //   hasChildren && open,
  // );
  // const selectedServer = useCurrentMediaSource('plex');
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

  // useEffect(() => {
  //   if (!isUndefined(children?.Metadata)) {
  //     addKnownMediaForPlexServer(server.id, children.Metadata, item.guid);
  //   }
  // }, [item.guid, server.id, children]);

  const handleItem = useCallback(
    (e: MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
      e.stopPropagation();
      // const id = props.extractors.id(item);
      // if (selectedMediaIds.includes(id)) {
      //   removePlexSelectedMedia(selectedServer!.id, [id]);
      // } else {
      //   addPlexSelectedMedia(selectedServer!, [item]);
      // }
      props.onSelect(item);
    },
    [props, item],
  );

  const { isIntersecting: isInViewport, ref: imageContainerRef } =
    useIntersectionObserver({
      threshold: 0,
      rootMargin: '0px',
      freezeOnceVisible: true,
    });

  // const extractChildCount = forPlexMedia({
  //   season: (s) => s.leafCount,
  //   show: (s) => s.childCount,
  //   collection: (s) => parseInt(s.childCount),
  // });

  let childCount = isUndefined(item) ? null : props.extractors.childCount(item);
  if (isNaN(childCount)) {
    childCount = null;
  }

  // const isMusicItem = ['artist', 'album', 'track', 'playlist'].includes(
  //   item.type,
  // );
  const isMusicItem = props.extractors.isMusicItem(item);
  const isEpisodeItem = props.extractors.isEpisode(item);

  // const isEpisodeItem = ['episode'].includes(item.type);
  // const isMusicItem =

  const thumbSrc: string = props.extractors.thumbnailUrl(item);
  // if (props.extractors.isPlaylist(item)) {
  //   thumbSrc = `${server.uri}${item.composite}?X-Plex-Token=${server.accessToken}`;
  // } else {
  //   const query = new URLSearchParams({
  //     mode: 'proxy',
  //     asset: 'thumb',
  //     id: createExternalId('plex', server.name, item.ratingKey),
  //     // Commenting this out for now as temporary solution for image loading issue
  //     // thumbOptions: JSON.stringify({ width: 480, height: 720 }),
  //   });

  //   thumbSrc = `${
  //     settings.backendUri
  //   }/api/metadata/external?${query.toString()}`;
  // }

  return (
    <Fade
      in={isInViewport && !isUndefined(item) && hasThumb === imageLoaded}
      timeout={750}
      ref={imageContainerRef}
    >
      <div>
        <ImageListItem
          component={Grid}
          key={props.extractors.id(item)}
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
            () => props.onClick(item)
            // hasChildren
            //   ? handleClick
            //   : (event: MouseEvent<HTMLDivElement>) => handleItem(event)
          }
          ref={imgListItemRef}
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
            title={props.extractors.title(item)}
            subtitle={props.extractors.subtitle(item)}
            position="below"
            actionIcon={
              <IconButton
                aria-label={`star ${props.extractors.title(item)}`}
                onClick={(event: MouseEvent<HTMLButtonElement>) =>
                  handleItem(event)
                }
              >
                {selectedMediaIds.includes(props.extractors.id(item)) ? (
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
}
// );
