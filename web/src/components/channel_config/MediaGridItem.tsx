import {
  addSelectedMedia,
  removeSelectedMedia,
} from '@/store/programmingSelector/actions.ts';
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
import { MediaSourceSettings } from '@tunarr/types';
import { filter, isNaN, isUndefined, some } from 'lodash-es';
import React, {
  ForwardedRef,
  MouseEvent,
  forwardRef,
  useCallback,
  useState,
} from 'react';
import { useIntersectionObserver } from 'usehooks-ts';
import useStore from '../../store/index.ts';
import {
  JellyfinSelectedMedia,
  PlexSelectedMedia,
  SelectedMedia,
} from '../../store/programmingSelector/store.ts';

export type GridItemMetadataExtractors<T> = {
  id: (item: T) => string;
  isPlaylist: (item: T) => boolean;
  hasThumbnail: (item: T) => boolean;
  childCount: (item: T) => number | null;
  isMusicItem: (item: T) => boolean;
  isEpisode: (item: T) => boolean;
  title: (item: T) => string;
  subtitle: (item: T) => JSX.Element | string | null;
  thumbnailUrl: (item: T) => string;
  selectedMedia: (item: T) => SelectedMedia;
};

type Props<T> = {
  item: T;
  itemSource: MediaSourceSettings['type'];
  extractors: GridItemMetadataExtractors<T>;
  style?: React.CSSProperties;
  index: number;
  isModalOpen: boolean;
  onClick: (item: T) => void;
  onSelect: (item: T) => void;
};

const MediaGridItemInner = <T,>(
  props: Props<T>,
  ref: ForwardedRef<HTMLDivElement>,
) => {
  // const settings = useSettings();
  const theme = useTheme();
  const skeletonBgColor = alpha(
    theme.palette.text.primary,
    theme.palette.mode === 'light' ? 0.11 : 0.13,
  );
  // const server = useCurrentMediaSource('plex')!; // We have to have a server at this point
  const darkMode = useStore((state) => state.theme.darkMode);
  const { item, extractors, style, isModalOpen, onClick } = props;
  const hasThumb = extractors.hasThumbnail(item);
  const [imageLoaded, setImageLoaded] = useState(false);
  // const hasChildren = !isTerminalItem(item);
  // const { data: children } = usePlexTyped<PlexChildMediaApiType<T>>(
  //   server.name,
  //   genPlexChildPath(props.item),
  //   hasChildren && open,
  // );
  // const selectedServer = useCurrentMediaSource('plex');
  const selectedMedia = useStore((s) =>
    filter(
      s.selectedMedia,
      (p): p is PlexSelectedMedia | JellyfinSelectedMedia =>
        p.type !== 'custom-show',
    ),
  );

  const handleClick = useCallback(() => {
    // moveModal(index, item);
    onClick(item);
  }, [item, onClick]);

  // useEffect(() => {
  //   if (!isUndefined(children?.Metadata)) {
  //     addKnownMediaForPlexServer(server.id, children.Metadata, item.guid);
  //   }
  // }, [item.guid, server.id, children]);

  const isSelected = some(
    selectedMedia,
    (sm) => sm.type === props.itemSource && sm.id === props.extractors.id(item),
  );

  const handleItem = useCallback(
    (e: MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
      e.stopPropagation();
      if (isSelected) {
        removeSelectedMedia([props.extractors.selectedMedia(props.item)]);
      } else {
        addSelectedMedia(props.extractors.selectedMedia(props.item));
      }
    },
    [props, isSelected],
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
      <div className="testtesteststestes">
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
              isModalOpen
                ? darkMode
                  ? theme.palette.grey[800]
                  : theme.palette.grey[400]
                : 'transparent',
            ...style,
          }}
          onClick={
            handleClick
            // hasChildren
            //   ? handleClick
            //   : (event: MouseEvent<HTMLDivElement>) => handleItem(event)
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
                {isSelected ? <CheckCircle /> : <RadioButtonUnchecked />}
              </IconButton>
            }
            actionPosition="right"
          />
        </ImageListItem>
      </div>
    </Fade>
  );
};
// );

export const MediaGridItem = forwardRef(MediaGridItemInner) as <T>(
  props: Props<T> & { ref?: ForwardedRef<HTMLDivElement> },
) => ReturnType<typeof MediaGridItemInner>;
