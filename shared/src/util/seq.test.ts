import { seq } from './index.js';

describe('seq', () => {
  test('collect takes a type predicate', () => {
    const pred = (n: number): n is 1 => n === 1;
    const out = seq.collect([1, 2, 3], pred);
    expect(out).toEqual([1]);
  });
});
