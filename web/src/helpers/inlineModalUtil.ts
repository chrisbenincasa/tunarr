import { PlexMedia } from '@tunarr/types/plex';

export function getImagesPerRow(
  containerWidth: number,
  imageWidth: number,
): number {
  const roundedImageWidth = Math.round(imageWidth * 100) / 100;

  if (!imageWidth || !containerWidth) {
    return 9; // some default value
  }

  return Math.round(((containerWidth / roundedImageWidth) * 100) / 100);
}

// Estimate the modal height to prevent div collapse while new modal images load
export function getEstimatedModalHeight(
  itemsPerRow: number,
  containerWidth: number,
  listSize: number,
  type: PlexMedia['type'] | 'all',
): number {
  // Episode modals have smaller height, short circuit for  now
  if (type === 'season') {
    return 143;
  }

  const imageContainerWidth = containerWidth / itemsPerRow;

  // If the container width isn't available yet, just exit and use the approx
  if (containerWidth === 0) {
    return (listSize / itemsPerRow) * 294; //299 is approx height of items
  }

  // Magic Numbers
  // to do: eventually grab this data via refs just in case it changes in the future
  const inlineModalTopPadding = 16;
  const imageContainerXPadding = 8;
  const listItemBarContainerHeight = 54;
  const heightPerImage = (3 * imageContainerWidth) / 2; // Movie Posters are 2:3
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

export function firstItemInNextRow(
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
    return numberOfItems - numberOfItemsLastRow;
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
  if (x > arr.length) {
    return arr.map((_, i) => i); // Return all indexes if x is too large
  }

  // Extract the last x elements
  const lastElements = arr.slice(-x);

  // Return last X indexes in new array
  return lastElements.map((_) => arr.indexOf(_));
}
