import { Collapse, List } from '@mui/material';
import { PlexMedia } from '@tunarr/types/plex';
import { usePrevious } from '@uidotdev/usehooks';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  firstItemInNextRow,
  getEstimatedModalHeight,
} from '../helpers/inlineModalUtil';
import { forPlexMedia } from '../helpers/util';
import useStore from '../store';
import PlexGridItem from './channel_config/PlexGridItem';

type InlineModalProps = {
  modalIndex: number;
  modalChildren?: PlexMedia[];
  open?: boolean;
  rowSize: number;
  type: string | null;
};

const plexTypeString = forPlexMedia({
  show: 'Series',
  collection: 'Collection',
  movie: 'Movie',
  episode: 'Episode',
  track: 'Track',
  album: 'Album',
  artist: 'Artist',
  default: 'All',
});

function InlineModal(props: InlineModalProps) {
  const { modalChildren, modalIndex, open, rowSize, type } = props;
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [itemWidth, setItemWidth] = useState<number>(0);
  const previousData = usePrevious(props);
  const ref = useRef<HTMLUListElement>(null);
  const gridItemRef = useRef<HTMLDivElement>(null);
  const darkMode = useStore((state) => state.theme.darkMode);
  const modalHeight = getEstimatedModalHeight(
    containerWidth,
    itemWidth,
    modalChildren?.length || 0,
    type,
  );

  useEffect(() => {
    if (
      ref.current &&
      previousData &&
      previousData.modalChildren !== modalChildren
    ) {
      const containerWidth = ref?.current?.offsetWidth || 0;
      const itemWidth = gridItemRef?.current?.offsetWidth || 0;

      setItemWidth(itemWidth);
      setContainerWidth(containerWidth);
    }
  }, [ref, modalChildren, gridItemRef]);

  const [childModalIndex, setChildModalIndex] = useState<number>(-1);
  const [childModalIsPending, setChildModalIsPending] = useState<boolean>(true);
  const [childModalChildren, setChildModalChildren] = useState<PlexMedia[]>([]);

  const handleMoveModal = useCallback(
    (index: number) => {
      if (index === childModalIndex) {
        handleModalChildren([]);
        setChildModalIndex(-1);
      } else {
        handleModalChildren([]);
        setChildModalIndex(index);
      }
    },
    [childModalIndex],
  );

  const handleModalChildren = useCallback(
    (children: PlexMedia[]) => {
      setChildModalChildren(children);
    },
    [modalChildren],
  );

  const handleModalIsPending = useCallback(
    (isPending: boolean) => {
      setChildModalIsPending(isPending);
    },
    [childModalIsPending],
  );

  return (
    <Collapse
      in={open}
      timeout="auto"
      easing={{
        enter: 'easeInSine',
        exit: 'linear',
      }}
      mountOnEnter
      unmountOnExit
      sx={{ width: '100%', display: 'grid', gridColumn: '1 / -1' }}
    >
      <List
        component={'ul'}
        sx={{
          pl: 4,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          alignContent: 'flex-start',
          flexWrap: 'wrap',
          justifyContent: 'flex-start',
          backgroundColor: (theme) =>
            darkMode ? theme.palette.grey[800] : theme.palette.grey[400],
          padding: '0',
          paddingTop: 2,
          minHeight: modalHeight,
        }}
        ref={ref}
      >
        {modalChildren?.map(
          (child: PlexMedia, idx: number, arr: PlexMedia[]) => (
            <React.Fragment key={child.guid}>
              <InlineModal
                modalIndex={childModalIndex} //to do
                modalChildren={childModalChildren} //to do
                open={
                  idx ===
                  firstItemInNextRow(
                    childModalIndex,
                    rowSize,
                    modalChildren?.length || 0,
                  )
                }
                rowSize={rowSize}
                type={plexTypeString(child)}
                // firstItemInNextRow={firstItemInNextRow}
              />
              <PlexGridItem
                key={child.guid}
                item={child}
                index={idx}
                modalIndex={modalIndex || childModalIndex}
                length={arr.length}
                ref={gridItemRef}
                moveModal={() => handleMoveModal(idx)}
                modalChildren={(children: PlexMedia[]) =>
                  handleModalChildren(children)
                }
                modalIsPending={(isPending: boolean) =>
                  handleModalIsPending(isPending)
                }
                // style={{
                //   backgroundColor:
                //     idx === childModalIndex ? 'red' : 'transparent',
                // }}
                // onClick={() => handleChildModal(child, idx)}
              />
            </React.Fragment>
          ),
        )}
      </List>
    </Collapse>
  );
}

export default memo(InlineModal);
