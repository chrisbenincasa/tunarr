import { CheckCircle, RadioButtonUnchecked } from '@mui/icons-material';
import {
  Fade,
  Unstable_Grid2 as Grid,
  IconButton,
  ImageListItem,
  ImageListItemBar,
} from '@mui/material';
import {
  PlexChildMediaApiType,
  PlexMedia,
  isPlexCollection,
  isTerminalItem,
} from '@tunarr/types/plex';
import _, { filter, isNaN } from 'lodash-es';
import React, {
  ForwardedRef,
  MouseEvent,
  forwardRef,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useIntersectionObserver } from 'usehooks-ts';
import { forPlexMedia, prettyItemDuration } from '../../helpers/util.ts';
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
  length?: number;
  parent?: string;
  moveModal?: CallableFunction;
  modalChildren?: CallableFunction;
  modalIsPending?: CallableFunction;
  modalIndex?: number;
  onClick?: any;
  ref?: React.RefObject<HTMLDivElement>;
}

const PlexGridItem = forwardRef(
  <T extends PlexMedia>(
    props: PlexGridItemProps<T>,
    ref: ForwardedRef<HTMLDivElement>,
  ) => {
    const server = useStore((s) => s.currentServer!); // We have to have a server at this point
    const darkMode = useStore((state) => state.theme.darkMode);
    const [open, setOpen] = useState(false);
    const { item, style, moveModal, modalChildren } = props;
    const hasChildren = !isTerminalItem(item);
    const childPath = isPlexCollection(item) ? 'collections' : 'metadata';
    const { isPending, data: children } = usePlexTyped<
      PlexChildMediaApiType<T>
    >(
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
      setOpen(!open);
      console.log('TEST');

      if (moveModal) {
        moveModal();

        if (children && modalChildren) {
          modalChildren(children.Metadata);
        }
      }
    };

    useEffect(() => {
      if (props.modalIsPending) {
        props.modalIsPending(isPending);
      }
    }, [isPending]);

    useEffect(() => {
      if (children) {
        addKnownMediaForServer(server.name, children.Metadata, item.guid);

        if (children.Metadata.length > 0 && !!modalChildren) {
          modalChildren(children.Metadata);
        }
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

    return (
      <Fade
        in={isInViewport && !_.isUndefined(item)} // TODO: eventually we will want to add in:  && imageLoaded so it only fades in after image has loaded
        timeout={500}
        ref={imageContainerRef}
      >
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
            transition: 'background-color 350ms linear !important',
            ...style,
          }}
          onClick={
            hasChildren
              ? handleClick
              : (event: MouseEvent<HTMLDivElement>) => handleItem(event)
          }
          ref={ref}
        >
          {isInViewport && ( // To do: Eventually turn this itno isNearViewport so images load before they hit the viewport
            <img
              src={`${server.uri}${item.thumb}?X-Plex-Token=${server.accessToken}`}
              width={100}
              style={{ borderRadius: '5%', height: 'auto' }}
            />
          )}
          <ImageListItemBar
            title={item.title}
            subtitle={
              item.type !== 'movie' ? (
                <span>{`${
                  !isNaN(extractChildCount(item)) && extractChildCount(item)
                } items`}</span>
              ) : (
                <span>{prettyItemDuration(item.duration)}</span>
              )
            }
            position="below"
            actionIcon={
              <IconButton
                sx={{ color: 'black' }}
                aria-label={`star ${item.title}`}
                onClick={(event: MouseEvent<HTMLButtonElement>) =>
                  handleItem(event)
                }
              >
                {selectedMediaIds.includes(item.guid) ? (
                  <CheckCircle sx={{ color: darkMode ? '#fff' : '#000' }} />
                ) : (
                  <RadioButtonUnchecked
                    sx={{ color: darkMode ? '#fff' : '#000' }}
                  />
                )}
              </IconButton>
            }
            actionPosition="right"
          />
        </ImageListItem>
      </Fade>
    );
  },
);

export default PlexGridItem;
