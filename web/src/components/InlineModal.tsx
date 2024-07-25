import { Box, Collapse, List } from '@mui/material';
import { usePrevious } from '@uidotdev/usehooks';
import _, { first } from 'lodash-es';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useIntersectionObserver } from 'usehooks-ts';
import {
  extractLastIndexes,
  findFirstItemInNextRowIndex,
  getEstimatedModalHeight,
  getImagesPerRow,
} from '../helpers/inlineModalUtil';
import { toggle } from '../helpers/util.ts';
import useStore from '../store';
import { MediaSourceSettings } from '@tunarr/types';
import { GridInlineModalProps } from './channel_config/MediaItemGrid.tsx';
import {
  useCurrentMediaSource,
  useKnownMedia,
} from '@/store/programmingSelector/selectors.ts';

interface InlineModalProps<ItemType, ItemKind extends string>
  extends GridInlineModalProps<ItemType> {
  getItemType: (item: ItemType) => ItemKind; // Tmp change //PlexMedia['type'] | 'all';
  getChildItemType: (item: ItemType) => ItemKind;
  sourceType: MediaSourceSettings['type'];
  extractItemId: (item: ItemType) => string;
}

export function InlineModal<ItemType, ItemKind extends string>(
  props: InlineModalProps<ItemType, ItemKind>,
) {
  const {
    itemGuid,
    modalIndex,
    open,
    rowSize,
    getItemType,
    getChildItemType,
    extractItemId,
    renderChildren,
  } = props;
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
  const currentMediaSource = useCurrentMediaSource(props.sourceType);
  const knownMedia = useKnownMedia();
  const modalChildren = knownMedia
    .getChildren(currentMediaSource!.id, itemGuid)
    .map((media) => media.item) as ItemType[];

  const modalHeight = useMemo(
    () =>
      getEstimatedModalHeight(
        rowSize,
        containerWidth,
        itemWidth,
        modalChildren.length,
        first(modalChildren) ? getItemType(first(modalChildren)!) : 'unknown',
      ),
    [containerWidth, itemWidth, modalChildren, rowSize, getItemType],
  );

  const toggleModal = useCallback(() => {
    console.log('hell');
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

  const [{ childModalIndex, childItemGuid }, setChildModalInfo] = useState<{
    childItemGuid: string | null;
    childModalIndex: number;
  }>({
    childItemGuid: null,
    childModalIndex: -1,
  });

  const firstItemInNextRowIndex = useMemo(
    () =>
      findFirstItemInNextRowIndex(
        childModalIndex,
        rowSize,
        modalChildren?.length ?? 0,
      ),
    [childModalIndex, modalChildren?.length, rowSize],
  );

  const handleMoveModal = useCallback(
    (index: number, item: ItemType) => {
      console.log('opening child model', index, item);
      const id = extractItemId(item);
      setChildModalInfo((prev) => {
        if (prev.childItemGuid === id) {
          return {
            childItemGuid: null,
            childModalIndex: -1,
          };
        } else {
          return {
            childItemGuid: id,
            childModalIndex: index,
          };
        }
      });
    },
    [extractItemId],
  );

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
        modalChildren.length % rowSize === 0
          ? rowSize
          : modalChildren.length % rowSize,
      ).includes(childModalIndex)
    : false;

  if (isOpen) {
    const item = knownMedia.getMediaOfType(
      currentMediaSource!.id,
      itemGuid,
      'jellyfin',
    );
    console.log(
      item?.Name,
      itemGuid,
      open,
      childItemGuid,
      childModalIndex,
      modalChildren,
      isFinalChildModalOpen,
      extractLastIndexes(
        modalChildren,
        modalChildren.length % rowSize === 0
          ? rowSize
          : modalChildren.length % rowSize,
      ),
    );
  }

  // const getChildModalProps = useCallback(
  //   (idx: number) => {
  //     return {
  //       itemGuid: childItemGuid ?? '',
  //       modalIndex: childModalIndex,
  //       open: idx === firstItemInNextRowIndex,
  //       renderChildren,
  //       rowSize: rowSize,
  //     };
  //   },
  //   [
  //     childItemGuid,
  //     childModalIndex,
  //     firstItemInNextRowIndex,
  //     renderChildren,
  //     rowSize,
  //   ],
  // );

  const renderChild = useCallback(
    (idx: number, item: ItemType) => {
      return renderChildren(
        {
          index: idx,
          item: item,
          modalIndex: modalIndex,
          moveModal: handleMoveModal,
          ref: gridItemRef,
        },
        {
          itemGuid: childItemGuid ?? '',
          modalIndex: childModalIndex,
          open: idx === firstItemInNextRowIndex,
          renderChildren,
          rowSize: rowSize,
        },
      );
    },
    [
      childItemGuid,
      childModalIndex,
      firstItemInNextRowIndex,
      handleMoveModal,
      modalIndex,
      renderChildren,
      rowSize,
    ],
  );

  return (
    <Box
      ref={inlineModalRef}
      component="div"
      className={'inline-modal-' + itemGuid}
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
            .take(childLimit)
            .map((item, idx) => renderChild(idx, item))
            .value()}
          {/* This Modal is for last row items because they can't be inserted using the above inline modal */}
          <InlineModal
            {...props}
            getItemType={getChildItemType}
            itemGuid={childItemGuid ?? ''}
            modalIndex={childModalIndex}
            open={isFinalChildModalOpen}
          />
          <li style={{ height: 40 }} ref={intersectionRef}></li>
        </List>
      </Collapse>
    </Box>
  );
}
