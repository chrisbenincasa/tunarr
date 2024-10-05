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
import { filter, isUndefined, some } from 'lodash-es';
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

export type GridItemMetadata = {
  itemId: string;
  isPlaylist: boolean;
  hasThumbnail: boolean;
  childCount: number | null;
  isMusicItem: boolean;
  isEpisode: boolean;
  title: string;
  subtitle: JSX.Element | string | null;
  thumbnailUrl: string;
  selectedMedia: SelectedMedia;
};

type Props<T> = {
  item: T;
  itemSource: MediaSourceSettings['type'];
  // extractors: GridItemMetadataExtractors<T>;
  metadata: GridItemMetadata;
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
  const theme = useTheme();
  const skeletonBgColor = alpha(
    theme.palette.text.primary,
    theme.palette.mode === 'light' ? 0.11 : 0.13,
  );

  const darkMode = useStore((state) => state.theme.darkMode);
  const {
    item,
    metadata: {
      hasThumbnail,
      thumbnailUrl,
      itemId,
      selectedMedia: selectedMediaItem,
      isMusicItem,
      isEpisode: isEpisodeItem,
      title,
      subtitle,
      childCount,
    },
    style,
    isModalOpen,
    onClick,
  } = props;
  const [imageLoaded, setImageLoaded] = useState(false);

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

  const isSelected = some(
    selectedMedia,
    (sm) => sm.type === props.itemSource && sm.id === itemId,
  );

  const handleItem = useCallback(
    (e: MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
      console.log('handle');
      e.stopPropagation();
      if (isSelected) {
        removeSelectedMedia([selectedMediaItem]);
      } else {
        addSelectedMedia(selectedMediaItem);
      }
    },
    [isSelected, selectedMediaItem],
  );

  const { isIntersecting: isInViewport, ref: imageContainerRef } =
    useIntersectionObserver({
      threshold: 0,
      rootMargin: '40px 0px 0px 0px',
      freezeOnceVisible: true,
    });

  return (
    <Fade
      in={isInViewport && !isUndefined(item) && hasThumbnail === imageLoaded}
      timeout={400}
      ref={imageContainerRef}
    >
      <div>
        <ImageListItem
          component={Grid}
          key={itemId}
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
          onClick={(e) =>
            (childCount ?? 0) === 0 ? handleItem(e) : handleClick()
          }
          ref={ref}
        >
          {isInViewport && // TODO: Eventually turn this into isNearViewport so images load before they hit the viewport
            (hasThumbnail ? (
              <Box
                sx={{
                  position: 'relative',
                  minHeight: isMusicItem ? 100 : isEpisodeItem ? 84 : 225, // 84 accomodates episode img height
                  maxHeight: '100%',
                }}
              >
                <img
                  src={thumbnailUrl}
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
            title={title}
            subtitle={subtitle}
            position="below"
            actionIcon={
              <IconButton
                aria-label={`star ${title}`}
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
