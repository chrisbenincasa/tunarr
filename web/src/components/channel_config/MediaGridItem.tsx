import {
  addSelectedMedia,
  removeSelectedMedia,
} from '@/store/programmingSelector/actions.ts';
import {
  CheckCircle,
  Folder,
  InfoSharp,
  RadioButtonUnchecked,
  WarningTwoTone,
} from '@mui/icons-material';
import type { Theme } from '@mui/material';
import {
  Box,
  Fade,
  Grid,
  IconButton,
  ImageListItem,
  ImageListItemBar,
  Skeleton,
  Tooltip,
  alpha,
  lighten,
  useTheme,
} from '@mui/material';
import { isNonEmptyString } from '@tunarr/shared/util';
import type { ProgramOrFolder } from '@tunarr/types';
import { isStructuralItemType, isTerminalItemType } from '@tunarr/types';
import { filter, isUndefined, some } from 'lodash-es';
import type { ForwardedRef, MouseEvent } from 'react';
import React, { forwardRef, useCallback, useMemo, useState } from 'react';
import { useIntersectionObserver } from 'usehooks-ts';
import { useShallow } from 'zustand/react/shallow';
import { useIsDarkMode } from '../../hooks/useTunarrTheme.ts';
import useStore from '../../store/index.ts';
import type {
  EmbySelectedMedia,
  JellyfinSelectedMedia,
  LocalLibrarySelectedMedia,
  PlexSelectedMedia,
  SelectedMedia,
} from '../../store/programmingSelector/store.ts';
import ProgramDetailsDialog from '../programs/ProgramDetailsDialog.tsx';

export type GridItemMetadata = {
  itemId: string;
  isPlaylist: boolean;
  childCount: number | null;
  mayHaveChildren?: boolean;
  aspectRatio: 'portrait' | 'landscape' | 'square';
  title: string;
  subtitle: JSX.Element | string | null;
  thumbnailUrl: string | null;
  selectedMedia?: SelectedMedia;
  isFolder?: boolean;
  persisted: boolean;
  itemType: ProgramOrFolder['type'];
};

type Props<ItemTypeT extends ProgramOrFolder> = {
  item: ItemTypeT;
  itemSource: SelectedMedia['type'];
  metadata: GridItemMetadata;
  style?: React.CSSProperties;
  index: number;
  isModalOpen: boolean;
  onClick: (item: ItemTypeT) => void;
  onSelect: (item: ItemTypeT) => void;
  depth: number;
  enableSelection?: boolean;
  disablePadding?: boolean;
};

const MediaGridItemInner = <ItemTypeT extends ProgramOrFolder>(
  props: Props<ItemTypeT>,
  ref: ForwardedRef<HTMLDivElement>,
) => {
  const theme = useTheme();
  const skeletonBgColor = alpha(
    theme.palette.text.primary,
    theme.palette.mode === 'light' ? 0.11 : 0.13,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const darkMode = useIsDarkMode();

  const {
    item,
    metadata: {
      thumbnailUrl,
      itemId,
      itemType,
      selectedMedia: selectedMediaItem,
      aspectRatio,
      title,
      subtitle,
      childCount,
      mayHaveChildren = false,
      isFolder = false,
      persisted,
    },
    style,
    isModalOpen,
    onClick,
    depth,
    enableSelection = true,
    disablePadding = false,
  } = props;

  const hasThumbnail = isNonEmptyString(thumbnailUrl);

  const [imageLoaded, setImageLoaded] = useState<
    'loading' | 'success' | 'error'
  >('loading');

  const selectedMedia = useStore(
    useShallow((s) =>
      filter(
        s.selectedMedia,
        (
          p,
        ): p is
          | PlexSelectedMedia
          | JellyfinSelectedMedia
          | EmbySelectedMedia
          | LocalLibrarySelectedMedia => p.type !== 'custom-show',
      ),
    ),
  );

  const handleClick = useCallback(() => {
    onClick(item);
  }, [item, onClick]);

  const isSelected = useMemo(
    () =>
      some(
        selectedMedia,
        (sm) => sm.type === props.itemSource && sm.id === itemId,
      ),
    [itemId, props.itemSource, selectedMedia],
  );

  const toggleItemSelect = useCallback(
    (e: MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
      e.stopPropagation();
      if (enableSelection && selectedMediaItem) {
        if (isSelected) {
          removeSelectedMedia([selectedMediaItem]);
        } else {
          addSelectedMedia(selectedMediaItem);
        }
      }
    },
    [enableSelection, isSelected, selectedMediaItem],
  );

  const { isIntersecting: isInViewport, ref: imageContainerRef } =
    useIntersectionObserver({
      threshold: 0,
      rootMargin: '40px 0px 0px 0px',
      freezeOnceVisible: true,
    });

  const minHeight = useMemo(() => {
    switch (aspectRatio) {
      case 'portrait':
        return 225;
      case 'landscape':
        return 84; // 84 accomodates episode img height
      case 'square':
        return 100;
    }
  }, [aspectRatio]);

  const backgroundColor = useCallback(
    (theme: Theme) => {
      if (!isModalOpen) {
        return 'transparent';
      }

      if (darkMode) {
        return lighten(theme.palette.grey[800], (depth + 1) / 10);
      }

      return theme.palette.grey[400];
    },
    [darkMode, depth, isModalOpen],
  );

  const showInfo = useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDialogOpen(true);
  }, []);

  const hasChildren = (childCount ?? 0) > 0 || mayHaveChildren;

  return (
    <>
      <Fade
        in={
          isInViewport &&
          !isUndefined(item) &&
          (isFolder ||
            (hasThumbnail &&
              (imageLoaded === 'success' || imageLoaded === 'error')) ||
            !hasThumbnail)
        }
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
              paddingLeft: disablePadding ? undefined : '8px !important',
              paddingRight: disablePadding ? undefined : '8px',
              paddingTop: disablePadding ? undefined : '8px',
              height: 'auto',
              backgroundColor: backgroundColor,
              ...style,
            }}
            onClick={(e) =>
              !enableSelection || hasChildren
                ? handleClick()
                : toggleItemSelect(e)
            }
            ref={ref}
          >
            {isTerminalItemType(item) && item.state === 'missing' && (
              <Tooltip title="Item was not present during the last scan">
                <WarningTwoTone
                  sx={{
                    position: 'absolute',
                    zIndex: 2,
                    top: disablePadding ? 8 : 16,
                    left: disablePadding ? 8 : 16,
                    cursor: 'pointer',
                    color: (theme) => theme.palette.warning.main,
                  }}
                />
              </Tooltip>
            )}
            {persisted && !isStructuralItemType(itemType) && (
              <InfoSharp
                inheritViewBox
                onClick={(e) => showInfo(e)}
                sx={{
                  position: 'absolute',
                  zIndex: 2,
                  top: disablePadding ? 8 : 16,
                  right: disablePadding ? 8 : 16,
                  cursor: 'pointer',
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(0, 0, 0, 0.7)'
                      : 'rgba(255, 255, 255, 0.7)',
                  borderRadius: '50%',
                  '&:hover': {
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(0, 0, 0, 0.7)'
                        : 'rgba(255, 255, 255, 0.7)',
                  },
                }}
              />
            )}

            {isInViewport && // TODO: Eventually turn this into isNearViewport so images load before they hit the viewport
              (isFolder ? (
                <Box
                  sx={{
                    position: 'relative',
                    minHeight,
                    maxHeight: '100%',
                    textAlign: 'center',
                  }}
                >
                  <Folder
                    sx={{
                      display: 'inline-block',
                      margin: '0 auto',
                      fontSize: '8em',
                    }}
                  />
                </Box>
              ) : hasThumbnail ? (
                <Box
                  sx={{
                    position: 'relative',
                    minHeight,
                    maxHeight: '100%',
                  }}
                >
                  <img
                    src={thumbnailUrl}
                    style={{
                      borderRadius: '5%',
                      height: 'auto',
                      width: '100%',
                      visibility:
                        imageLoaded === 'success' ? 'visible' : 'hidden',
                      zIndex: 2,
                      display: imageLoaded === 'error' ? 'none' : undefined,
                    }}
                    onLoad={() => setImageLoaded('success')}
                    onError={() => setImageLoaded('error')}
                  />
                  <Box
                    component="div"
                    sx={{
                      background: skeletonBgColor,
                      borderRadius: '5%',
                      position:
                        imageLoaded === 'success' ? 'absolute' : 'relative',
                      top: 0,
                      left: 0,
                      aspectRatio:
                        aspectRatio === 'square'
                          ? '1/1'
                          : aspectRatio === 'landscape'
                            ? '1.77/1'
                            : '2/3',
                      width: '100%',
                      height: 'auto',
                      zIndex: 1,
                      opacity: imageLoaded === 'success' ? 0 : 1,
                      visibility:
                        imageLoaded === 'success' ? 'hidden' : 'visible',
                      minHeight,
                    }}
                  ></Box>
                </Box>
              ) : (
                <Skeleton
                  animation={false}
                  variant="rounded"
                  sx={{ borderRadius: '5%' }}
                  height={minHeight}
                />
              ))}
            <ImageListItemBar
              title={title}
              subtitle={subtitle}
              position="below"
              actionIcon={
                enableSelection ? (
                  <IconButton
                    aria-label={`star ${title}`}
                    onClick={(event: MouseEvent<HTMLButtonElement>) =>
                      toggleItemSelect(event)
                    }
                  >
                    {isSelected ? <CheckCircle /> : <RadioButtonUnchecked />}
                  </IconButton>
                ) : null
              }
              actionPosition="right"
            />
          </ImageListItem>
        </div>
      </Fade>
      {persisted && !isStructuralItemType(itemType) && (
        <ProgramDetailsDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          programId={itemId}
          programType={itemType}
        />
      )}
    </>
  );
};
// );

export const MediaGridItem = forwardRef(MediaGridItemInner) as <
  ItemTypeT extends ProgramOrFolder,
>(
  props: Props<ItemTypeT> & { ref?: ForwardedRef<HTMLDivElement> },
) => ReturnType<typeof MediaGridItemInner>;
