import { PlexMedia } from '@tunarr/types/plex';

export function getImagesPerRow(
  containerWidth: number,
  imageWidth: number,
): number {
  return Math.floor(containerWidth / imageWidth);
}

// Estimate the modal height to prevent div collapse while new modal images load
export function getEstimatedModalHeight(
  containerWidth: number,
  imageWidth: number,
  listSize: number,
): number {
  const columns = getImagesPerRow(containerWidth, imageWidth);
  const widthPerItem = containerWidth / columns;
  const heightPerItem = widthPerItem * 1.72 + 8; //8  magic number for margin-top of each item
  const rows = listSize < columns ? 1 : Math.ceil(listSize / columns);
  //This is min-height so we only need to adjust it for visible rows since we
  //use interesectionObserver to load them in
  const maxRows = rows >= 3 ? 3 : rows;

  return maxRows * heightPerItem;
}

export function firstItemInNextRow(
  modalIndex: number,
  itemsPerRow: number,
  numberOfItems: number,
): number {
  // Calculate the row number of the current item
  const rowNumber = Math.floor(modalIndex / itemsPerRow);

  if (modalIndex === -1) {
    return -1;
  }

  // If the item clicked is on the last row and the last row isn't full, adjust where modal is inserted
  // for now the final rows modal will be inserted above these items
  const numberOfItemsLastRow = numberOfItems % itemsPerRow;

  if (
    modalIndex >= numberOfItems - numberOfItemsLastRow &&
    numberOfItemsLastRow < itemsPerRow
  ) {
    console.log('TEST');

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

  // Use map to create a new array with corresponding indexes
  return lastElements.map((_) => arr.indexOf(_));
}
