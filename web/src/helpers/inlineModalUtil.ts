import { PlexMedia } from '@tunarr/types/plex';
import { range } from 'lodash-es';

// Magic Numbers
// TODO: eventually grab this data via refs just in case it changes in the future
const SeasonModalHeight = 204;
const DefaultSingleRowModalHeight = 294;
const inlineModalTopPadding = 16;
const imageContainerXPadding = 8;
const listItemBarContainerHeight = 54;

export function getImagesPerRow(
  containerWidth: number,
  imageWidth: number,
): number {
  if (imageWidth <= 0 || containerWidth <= 0) {
    return 9; // some default value
  }

  const roundedImageWidth = Math.round(imageWidth * 100) / 100;

  return Math.round(((containerWidth / roundedImageWidth) * 100) / 100);
}

// Estimate the modal height to prevent div collapse while new modal images load
export function getEstimatedModalHeight(
  itemsPerRow: number,
  containerWidth: number,
  imageContainerWidth: number,
  listSize: number,
  type: PlexMedia['type'] | 'all',
): number {
  // Episode modals have smaller height, short circuit for  now
  if (type === 'season') {
    return SeasonModalHeight;
  }
  // Exit with defaults if container & image width are not provided
  if (containerWidth === 0 || imageContainerWidth === 0) {
    return DefaultSingleRowModalHeight; //default modal height for 1 row
  }

  const imagewidth = imageContainerWidth - imageContainerXPadding * 2; // 16px padding on each item
  const heightPerImage = (3 * imagewidth) / 2; // Movie Posters are 2:3
  const heightPerItem =
    heightPerImage + listItemBarContainerHeight + imageContainerXPadding; // 54px

  const rows = listSize < itemsPerRow ? 1 : Math.ceil(listSize / itemsPerRow);
  //This is min-height so we only need to adjust it for visible rows since we
  //use interesectionObserver to load them in
  const maxRows = rows >= 3 ? 3 : rows;

  return Math.ceil(maxRows * heightPerItem + inlineModalTopPadding); // 16px padding added to top
}

export function isNewModalAbove(
  previousModalIndex: number,
  newModalIndex: number,
  itemsPerRow: number,
) {
  // Calculate the row number of the current item
  const previousRowNumber = Math.floor(previousModalIndex / itemsPerRow);
  const newRowNumber = Math.floor(newModalIndex / itemsPerRow);

  if (previousModalIndex === -1 || newModalIndex === -1) {
    //Modal is opening or closing, not moving
    return false;
  } else {
    return newRowNumber > previousRowNumber;
  }
}

/**
 * Returns the index to insert the InlineModal
 * Will return -1 if the modal is not open or if there
 * are no items
 */
export function findFirstItemInNextRowIndex(
  modalIndex: number,
  itemsPerRow: number,
  numberOfItems: number,
): number {
  // Calculate the row number of the current item
  const rowNumber = Math.floor(modalIndex / itemsPerRow);

  // Modal is closed or collection has no data, exit
  if (modalIndex === -1 || numberOfItems === 0) {
    return -1;
  }

  // If the item clicked is on the last row and the last row isn't full, adjust where modal is inserted
  // for now the final rows modal will be inserted above these items
  const numberOfItemsLastRow = numberOfItems % itemsPerRow;

  if (
    modalIndex >= numberOfItems - numberOfItemsLastRow &&
    numberOfItemsLastRow < itemsPerRow
  ) {
    return -1;
  }

  // If the current item is not in the last row, return the index of the first item in the next row
  if (
    rowNumber <=
    (modalIndex > 0 ? modalIndex : 1) / // Account for modalIndex = 0
      itemsPerRow
  ) {
    return (rowNumber + 1) * itemsPerRow;
  }

  // Otherwise, return -1 to indicate modal is closed
  return -1;
}

export function extractLastIndexes(arr: PlexMedia[], x: number): number[] {
  const indexes = range(0, arr.length);
  if (x > arr.length) {
    return indexes;
  }

  return indexes.slice(-x);
}
