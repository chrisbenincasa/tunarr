import { Collapse, List } from '@mui/material';
import { PlexMedia } from '@tunarr/types/plex';
import { usePrevious } from '@uidotdev/usehooks';
import { memo, useEffect, useRef, useState } from 'react';
import { getEstimatedModalHeight } from '../helpers/inlineModalUtil';
import useStore from '../store';
import PlexGridItem from './channel_config/PlexGridItem';

type InlineModalProps = {
  modalIndex: number;
  modalChildren?: PlexMedia[];
  open?: boolean;
};

function InlineModal(props: InlineModalProps) {
  const { modalChildren, modalIndex, open } = props;
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
            <PlexGridItem
              key={child.guid}
              item={child}
              index={idx}
              modalIndex={modalIndex}
              length={arr.length}
              ref={gridItemRef}
            />
          ),
        )}
      </List>
    </Collapse>
  );
}

export default memo(InlineModal);
