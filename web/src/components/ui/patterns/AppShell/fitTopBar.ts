// Pixel widths taken from an offscreen copy of the bar, so the layout can be
// chosen before anything is hidden.
export type TopBarMeasurements = {
  // Width of the bar's content box, which everything below must fit inside.
  barWidth: number;

  logoWidth: number;

  // The "Tunarr" text beside the logo.
  wordmarkWidth: number;

  // One entry per section pill, in nav order.
  sectionWidths: number[];
  sectionGap: number;

  // The More button that holds sections that do not fit.
  moreButtonWidth: number;

  // The search control as a full pill with its shortcut, and as an icon.
  searchPillWidth: number;
  searchIconWidth: number;

  // Color mode, help and Settings, with the gaps between them.
  actionsWidth: number;

  // Gap between the search control and the actions.
  actionGap: number;

  // Gap between the brand, the section nav and the right-hand group.
  groupGap: number;
};

export type TopBarLayout = {
  search: 'full' | 'icon';
  wordmark: boolean;
  visible: number[];
  overflow: number[];
};

// One arrangement of the bar to test against the available width.
type Candidate = {
  search: TopBarLayout['search'];
  wordmark: boolean;

  // Indexes into `sectionWidths` of the sections shown as pills.
  shown: number[];
  withMore: boolean;
};

// Below this bar width the search pill always shrinks to an icon.
export const SearchPillMinBarWidth = 1000;

const navWidth = (m: TopBarMeasurements, { shown, withMore }: Candidate) => {
  const widths = shown.map((i) => m.sectionWidths[i] ?? 0);
  if (withMore) {
    widths.push(m.moreButtonWidth);
  }
  if (widths.length === 0) {
    return 0;
  }
  return widths.reduce((a, b) => a + b, 0) + m.sectionGap * (widths.length - 1);
};

const fits = (m: TopBarMeasurements, candidate: Candidate) => {
  const brand = m.logoWidth + (candidate.wordmark ? m.wordmarkWidth : 0);
  const search =
    candidate.search === 'full' ? m.searchPillWidth : m.searchIconWidth;
  const right = search + m.actionGap + m.actionsWidth;
  return (
    brand + m.groupGap + navWidth(m, candidate) + m.groupGap + right <=
    m.barWidth
  );
};

// The bar gives up space in a fixed order: the search pill becomes an icon,
// then the wordmark drops, then sections move under More from the right.
// The active section never moves under More.
export function fitTopBar(
  m: TopBarMeasurements,
  activeIndex?: number,
): TopBarLayout {
  const all = m.sectionWidths.map((_, i) => i);

  if (
    m.barWidth >= SearchPillMinBarWidth &&
    fits(m, { search: 'full', wordmark: true, shown: all, withMore: false })
  ) {
    return { search: 'full', wordmark: true, visible: all, overflow: [] };
  }
  if (
    fits(m, { search: 'icon', wordmark: true, shown: all, withMore: false })
  ) {
    return { search: 'icon', wordmark: true, visible: all, overflow: [] };
  }
  if (
    fits(m, { search: 'icon', wordmark: false, shown: all, withMore: false })
  ) {
    return { search: 'icon', wordmark: false, visible: all, overflow: [] };
  }

  const visible = [...all];
  const overflow: number[] = [];
  while (
    visible.length > 0 &&
    !fits(m, {
      search: 'icon',
      wordmark: false,
      shown: visible,
      withMore: true,
    })
  ) {
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
