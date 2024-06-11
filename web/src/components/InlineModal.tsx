import { Box, Collapse, List } from '@mui/material';
import { PlexMedia, isPlexMedia, isPlexParentItem } from '@tunarr/types/plex';
import { usePrevious } from '@uidotdev/usehooks';
import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import {
  extractLastIndexes,
  findFirstItemInNextRowIndex,
  getEstimatedModalHeight,
  getImagesPerRow,
} from '../helpers/inlineModalUtil';
import _ from 'lodash-es';
import useStore from '../store';
import { PlexGridItem } from './channel_config/PlexGridItem';
import { toggle } from '../helpers/util.ts';
import React from 'react';
import { useIntersectionObserver } from 'usehooks-ts';

type InlineModalProps = {
  itemGuid: string;
  modalIndex: number;
  open?: boolean;
  rowSize: number;
  type: PlexMedia['type'] | 'all';
};

export function InlineModal(props: InlineModalProps) {
  const { itemGuid, modalIndex, open, rowSize, type } = props;
  const previousItemGuid = usePrevious(itemGuid);
  const [containerWidth, setContainerWidth] = useState(0);
  const [itemWidth, setItemWidth] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLUListElement>(null);
  const gridItemRef = useRef<HTMLDivElement>(null);
  const inlineModalRef = useRef<HTMLDivElement>(null);
  const darkMode = useStore((state) => state.theme.darkMode);
  const [childLimit, setChildLimit] = useState(9);
  const [imagesPerRow, setImagesPerRow] = useState(0);
  const modalChildren: PlexMedia[] = useStore((s) => {
    const known = s.contentHierarchyByServer[s.currentServer!.name];
    if (known) {
      const children = known[itemGuid];
      if (children) {
        return _.chain(children)
          .map((id) => s.knownMediaByServer[s.currentServer!.name][id])
          .compact()
          .filter(isPlexMedia)
          .value();
      }
    }

    return [];
  });

  const modalHeight = useMemo(
    () =>
      getEstimatedModalHeight(
        rowSize,
        containerWidth,
        itemWidth,
        modalChildren.length,
        type,
      ),
    [containerWidth, itemWidth, modalChildren?.length, rowSize, type],
  );

  const toggleModal = useCallback(() => {
    setIsOpen(toggle);
  }, []);

  useEffect(() => {
    if (ref.current && previousItemGuid !== itemGuid) {
      const containerWidth = ref?.current?.getBoundingClientRect().width || 0;
      const itemWidth =
        gridItemRef?.current?.getBoundingClientRect().width || 0;
      const imagesPerRow = getImagesPerRow(containerWidth, itemWidth);
      setChildLimit(imagesPerRow * 2);
      setItemWidth(itemWidth);
      setContainerWidth(containerWidth);
      setImagesPerRow(imagesPerRow);
    }
  }, [ref, gridItemRef, previousItemGuid, itemGuid]);

  const [childItemGuid, setChildItemGuid] = useState<string | null>(null);
  const [childModalIndex, setChildModalIndex] = useState(-1);

  const firstItemInNextRowIndex = useMemo(
    () =>
      findFirstItemInNextRowIndex(
        childModalIndex,
        rowSize,
        modalChildren?.length ?? 0,
      ),
    [childModalIndex, modalChildren?.length, rowSize],
  );

  const handleMoveModal = useCallback((index: number, item: PlexMedia) => {
    setChildItemGuid((prev) => (prev === item.guid ? null : item.guid));
    setChildModalIndex((prev) => (prev === index ? -1 : index));
  }, []);

  // TODO: Complete this by updating the limit below, not doing this
  // right now because already working with a huge changeset.
  const { ref: intersectionRef } = useIntersectionObserver({
    onChange: (_, entry) => {
      if (entry.isIntersecting && isOpen) {
        if (childLimit < modalChildren.length) {
          setChildLimit((prev) => prev + imagesPerRow * 2);
        }
      }
    },
    threshold: 0.5,
  });

  const isFinalChildModalOpen = modalChildren
    ? extractLastIndexes(
        modalChildren,
        modalChildren.length % rowSize,
      ).includes(childModalIndex)
    : false;

  return (
    <Box
      ref={inlineModalRef}
      component="div"
      sx={{
        display: isOpen ? 'grid' : 'none',
        gridColumn: isOpen ? '1 / -1' : undefined,
      }}
    >
      <Collapse
        in={open}
        timeout={100}
        easing={{
          enter: 'easeInSine',
          exit: 'easeOutSine',
        }}
        mountOnEnter
        unmountOnExit
        sx={{ width: '100%', display: 'grid', gridColumn: '1 / -1' }}
        onEnter={toggleModal}
        onExited={toggleModal}
      >
        <List
          component="ul"
          sx={{
            pl: 4,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            alignContent: 'flex-start',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            backgroundColor: (theme) =>
              darkMode ? theme.palette.grey[800] : theme.palette.grey[400],
            padding: 0,
            paddingTop: 2,
            minHeight: modalHeight,
            borderBottomLeftRadius: '0.5em',
            borderBottomRightRadius: '0.5em',
          }}
          ref={ref}
        >
          {_.chain(modalChildren)
            .filter(isPlexMedia)
            .take(childLimit)
            .map((child: PlexMedia, idx: number) => (
              <React.Fragment key={child.guid}>
                {isPlexParentItem(child) && (
                  <InlineModal
                    itemGuid={childItemGuid ?? ''}
                    modalIndex={childModalIndex}
                    open={idx === firstItemInNextRowIndex}
                    rowSize={rowSize}
                    type={child.type}
                  />
                )}
                <PlexGridItem
                  item={child}
                  index={idx}
                  modalIndex={modalIndex ?? childModalIndex}
                  ref={gridItemRef}
                  moveModal={handleMoveModal}
                />
              </React.Fragment>
            ))
            .value()}
          {/* This Modal is for last row items because they can't be inserted using the above inline modal */}
          <InlineModal
            itemGuid={childItemGuid ?? ''}
            modalIndex={childModalIndex}
            rowSize={rowSize}
            open={isFinalChildModalOpen}
            type={'season'}
          />
          <li style={{ height: 40 }} ref={intersectionRef}></li>
        </List>
      </Collapse>
    </Box>
  );
}
