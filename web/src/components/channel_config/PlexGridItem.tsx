import { CheckCircle, RadioButtonUnchecked } from '@mui/icons-material';
import {
  Fade,
  Unstable_Grid2 as Grid,
  IconButton,
  ImageListItem,
  ImageListItemBar,
  Skeleton,
} from '@mui/material';
import {
  PlexChildMediaApiType,
  PlexMedia,
  isPlexCollection,
  isTerminalItem,
} from '@tunarr/types/plex';
import { filter, isNaN, isNull, isUndefined } from 'lodash-es';
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
import { usePlexTyped } from '../../hooks/plexHooks.ts';
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

export const PlexGridItem = forwardRef(
  <T extends PlexMedia>(
    props: PlexGridItemProps<T>,
    ref: ForwardedRef<HTMLDivElement>,
  ) => {
    const server = useStore((s) => s.currentServer!); // We have to have a server at this point
    const darkMode = useStore((state) => state.theme.darkMode);
    const [open, setOpen] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const { item, index, style, moveModal } = props;
    const hasChildren = !isTerminalItem(item);
    const childPath = isPlexCollection(item) ? 'collections' : 'metadata';
    const { data: children } = usePlexTyped<PlexChildMediaApiType<T>>(
      server.name,
      `/library/${childPath}/${props.item.ratingKey}/children`,
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

    return (
      <Fade
        in={
          isInViewport &&
          !isUndefined(item) &&
          (imageLoaded || !isNonEmptyString(item.thumb))
        }
        timeout={500}
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
              borderRadiusTopLeft: '10px',
              borderRadiusTopRight: '10px',
              height: 'auto',
              backgroundColor: (theme) =>
                props.modalIndex === props.index
                  ? darkMode
                    ? theme.palette.grey[800]
                    : theme.palette.grey[400]
                  : 'transparent',
              borderTopLeftRadius: '0.5em',
              borderTopRightRadius: '0.5em',
              ...style,
            }}
            onClick={
              hasChildren
                ? handleClick
                : (event: MouseEvent<HTMLDivElement>) => handleItem(event)
            }
            ref={ref}
          >
            {isInViewport && // TODO: Eventually turn this itno isNearViewport so images load before they hit the viewport
              (isNonEmptyString(item.thumb) ? (
                // TODO: Use server endpoint for plex metdata
                <img
                  src={`${server.uri}${item.thumb}?X-Plex-Token=${server.accessToken}`}
                  style={{ borderRadius: '5%', height: 'auto' }}
                  onLoad={() => setImageLoaded(true)}
                />
              ) : (
                <Skeleton
                  variant="rectangular"
                  animation={false}
                  sx={{ borderRadius: '5%' }}
                  height={250}
                />
              ))}
            {!imageLoaded && (
              <Skeleton
                variant="rectangular"
                sx={{ borderRadius: '5%' }}
                height={250}
              />
            )}
            <ImageListItemBar
              title={item.title}
              subtitle={
                item.type !== 'movie' ? (
                  !isNull(childCount) ? (
                    <span>{`${childCount} ${pluralize(
                      'item',
                      childCount,
                    )}`}</span>
                  ) : null
                ) : (
                  <span>{prettyItemDuration(item.duration)}</span>
                )
              }
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
