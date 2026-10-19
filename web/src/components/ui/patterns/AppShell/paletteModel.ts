export type PaletteItem = {
  id: string;
  group: string;
  label: string;
  kind: string;

  // Channel number, shown in mono before the label.
  number?: string;
};

export type PaletteGroup = {
  name: string;
  items: PaletteItem[];
};

export const MaxItemsPerGroup = 6;

const rank = (item: PaletteItem, needle: string) => {
  const label = item.label.toLocaleLowerCase();
  if (label.startsWith(needle) || item.number === needle) {
    return 0;
  }
  if (label.split(/\s+/).some((word) => word.startsWith(needle))) {
    return 1;
  }
  return label.includes(needle) ? 2 : undefined;
};

// Keeps the input's group order. Within a group, label prefixes come first,
// then word prefixes, then any substring. An empty query keeps every item.
export function filterPalette(
  items: PaletteItem[],
  query: string,
  maxPerGroup = MaxItemsPerGroup,
): PaletteGroup[] {
  const needle = query.trim().toLocaleLowerCase();
  const groups = new Map<
    string,
    { item: PaletteItem; rank: number; order: number }[]
  >();

  items.forEach((item, order) => {
    const r = needle.length === 0 ? 0 : rank(item, needle);
    if (r === undefined) {
      return;
    }
    const list = groups.get(item.group) ?? [];
    list.push({ item, rank: r, order });
    groups.set(item.group, list);
  });

  return [...groups.entries()].map(([name, list]) => ({
    name,
    items: list
      .sort((a, b) => a.rank - b.rank || a.order - b.order)
      .slice(0, maxPerGroup)
      .map(({ item }) => item),
  }));
}
