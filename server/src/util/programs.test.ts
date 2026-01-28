import { titleToSortTitle } from './programs.ts';

describe('program utils', () => {
  describe('titleToSortTitle', () => {
    test('numeric titles', () => {
      const result = titleToSortTitle('2 Fast 2 Furious');
      console.log(result);
    });
  });
});
