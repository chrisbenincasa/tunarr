import { describe, expect, test } from 'vitest';
import { sizes } from './themeTokens.ts';

describe('sizes', () => {
  // Sticky offsets read shellBarHeight, so it has to match the bar's real box.
  test.each(Object.entries(sizes))(
    '%s shellBarHeight matches the top bar padding and item height',
    (_, s) => {
      expect(s.shellBarHeight).toBe(s.shellPaddingY * 2 + s.navItemHeight);
    },
  );
});
