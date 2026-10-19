export type TopBarMeasurements = {
  // Width of the bar's content box.
  available: number;
  logo: number;
  wordmark: number;
  sections: number[];
  sectionGap: number;
  more: number;
  searchFull: number;
  searchIcon: number;

  // Color mode, help and Settings, with the gaps between them.
  actions: number;
  actionGap: number;

  // Gap between the brand, the section nav and the actions.
  groupGap: number;
};

export type TopBarLayout = {
  search: 'full' | 'icon';
  wordmark: boolean;
  visible: number[];
  overflow: number[];
};

// Below this bar width the search pill always shrinks to an icon.
export const SearchPillMinBarWidth = 1000;

const navWidth = (
  m: TopBarMeasurements,
  shown: number[],
  withMore: boolean,
) => {
  const widths = shown.map((i) => m.sections[i] ?? 0);
  if (withMore) {
    widths.push(m.more);
  }
  if (widths.length === 0) {
    return 0;
  }
  return widths.reduce((a, b) => a + b, 0) + m.sectionGap * (widths.length - 1);
};

const fits = (
  m: TopBarMeasurements,
  search: TopBarLayout['search'],
  wordmark: boolean,
  shown: number[],
  withMore: boolean,
) => {
  const brand = m.logo + (wordmark ? m.wordmark : 0);
  const right =
    (search === 'full' ? m.searchFull : m.searchIcon) + m.actionGap + m.actions;
  return (
    brand + m.groupGap + navWidth(m, shown, withMore) + m.groupGap + right <=
    m.available
  );
};

// The bar gives up space in a fixed order: the search pill becomes an icon,
// then the wordmark drops, then sections move under More from the right.
// The active section never moves under More.
export function fitTopBar(
  m: TopBarMeasurements,
  activeIndex?: number,
): TopBarLayout {
  const all = m.sections.map((_, i) => i);

  if (
    m.available >= SearchPillMinBarWidth &&
    fits(m, 'full', true, all, false)
  ) {
    return { search: 'full', wordmark: true, visible: all, overflow: [] };
  }
  if (fits(m, 'icon', true, all, false)) {
    return { search: 'icon', wordmark: true, visible: all, overflow: [] };
  }
  if (fits(m, 'icon', false, all, false)) {
    return { search: 'icon', wordmark: false, visible: all, overflow: [] };
  }

  const visible = [...all];
  const overflow: number[] = [];
  while (visible.length > 0 && !fits(m, 'icon', false, visible, true)) {
    let dropAt = visible.length - 1;
    while (dropAt >= 0 && visible[dropAt] === activeIndex) {
      dropAt--;
    }
    if (dropAt < 0) {
      break;
    }
    overflow.unshift(...visible.splice(dropAt, 1));
  }

  return { search: 'icon', wordmark: false, visible, overflow };
}
