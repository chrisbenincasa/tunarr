import { floor, range } from 'lodash-es';
import { estimateNumberOfColumns } from './util';

export function getImagesPerRow(
  containerWidth: number,
  imageWidth: number,
): number {
  if (imageWidth <= 0 || containerWidth <= 0) {
    return containerWidth > 0 ? estimateNumberOfColumns(containerWidth) : 8; // some default value
  }

  return floor(containerWidth / imageWidth);
}

// Estimate the modal height to prevent div collapse while new modal images load

export function isNewModalBelow(
  previousModalIndex: number,
  newModalIndex: number,
  itemsPerRow: number,
) {
  //Modal is opening or closing, not moving
  if (previousModalIndex === -1 || newModalIndex === -1) {
    return false;
  }

  // Calculate the row number of the current item
  const previousRowNumber = Math.floor(previousModalIndex / itemsPerRow);
  const newRowNumber = Math.floor(newModalIndex / itemsPerRow);

  return newRowNumber > previousRowNumber;
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
  // Modal is closed or collection has no data, exit
  if (modalIndex === -1 || numberOfItems === 0) {
    return -1;
  }

  // Calculate the row number of the current item
  const numRows = Math.floor(numberOfItems / itemsPerRow);
  const rowNumber = Math.floor(modalIndex / itemsPerRow);

  // If the item clicked is on the last row and the last row isn't full, adjust where modal is inserted
  // for now the final rows modal will be inserted above these items
  // const numberOfItemsLastRow = numberOfItems % itemsPerRow;

  if (rowNumber === numRows) {
    return numberOfItems;
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

export function findLastItemInRowIndex(
  selectedItemIndex: number,
  itemsPerRow: number,
  totalItems: number,
) {
  if (selectedItemIndex < 0 || totalItems <= 0) {
    return -1;
  }

  const totalRows = Math.floor(totalItems / itemsPerRow);
  const currentRow = Math.floor(selectedItemIndex / itemsPerRow);

  // Return the last index
  if (currentRow === totalRows) {
    return totalItems - 1;
  }

  // Return the nearest end index of each row. The calculation
  // rounds to the nearest itemsPerRow (i.e. the end of the row)
  // and then subtracts one to be used to index the array directly.
  const nearestEndIndex =
    Math.ceil((selectedItemIndex + 1) / itemsPerRow) * itemsPerRow;
  return nearestEndIndex - 1;
}

export function extractLastIndexes(arr: unknown[], x: number): number[] {
  const indexes = range(0, arr.length);
  if (x > arr.length) {
    return indexes;
  }

  return indexes.slice(-x);
}
