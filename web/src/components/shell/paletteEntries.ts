import {
  filterPalette,
  type PaletteGroup,
  type PaletteItem,
  type ShellNav,
} from '@/components/ui/patterns/AppShell';
import type { NavigateOptions } from '@tanstack/react-router';
import { search } from '@tunarr/shared/util';

export type PaletteEntry = {
  item: PaletteItem;
  go: NavigateOptions;

  // Pages and settings. These are the only entries listed before a query.
  browse: boolean;
};

export type PaletteLabels = {
  pages: string;
  page: string;
  channels: string;
  channel: string;
  customShows: string;
  customShow: string;
  fillerLists: string;
  fillerList: string;
  smartCollections: string;
  smartCollection: string;
};

export type PaletteData = {
  channels?: { id: string; name: string; number: number }[];
  customShows?: { id: string; name: string }[];
  fillers?: { id: string; name: string }[];
  smartCollections?: { uuid: string; name: string }[];
};

export function buildPaletteEntries(
  nav: ShellNav,
  labels: PaletteLabels,
  data: PaletteData,
): PaletteEntry[] {
  const out: PaletteEntry[] = [];
  const add = (
    group: string,
    id: string,
    label: string,
    kind: string,
    go: NavigateOptions,
    browse: boolean,
    number?: string,
  ) =>
    out.push({
      item: { id: `${group}:${id}`, group, label, kind, number },
      go,
      browse,
    });

  for (const section of nav.sections.filter((s) => !s.hidden)) {
    if (section.pages.length === 0) {
      add(
        labels.pages,
        section.id,
        section.label,
        labels.page,
        {
          to: section.to,
        },
        true,
      );
    }
    for (const page of section.pages) {
      add(
        labels.pages,
        `${section.id}/${page.id}`,
        page.label,
        section.label,
        { to: page.to },
        true,
      );
    }
  }

  const settings = nav.settings.label;
  for (const page of nav.settings.pages) {
    add(settings, page.id, page.label, settings, { to: page.to }, true);
  }

  for (const channel of data.channels ?? []) {
    add(
      labels.channels,
      channel.id,
      channel.name,
      labels.channel,
      { to: '/channels/$channelId', params: { channelId: channel.id } },
      false,
      channel.number.toString(),
    );
  }

  for (const show of data.customShows ?? []) {
    add(
      labels.customShows,
      show.id,
      show.name,
      labels.customShow,
      {
        to: '/library/custom-shows/$showId/edit',
        params: { showId: show.id },
      },
      false,
    );
  }

  for (const filler of data.fillers ?? []) {
    add(
      labels.fillerLists,
      filler.id,
      filler.name,
      labels.fillerList,
      {
        to: '/library/fillers/$fillerId/edit',
        params: { fillerId: filler.id },
      },
      false,
    );
  }

  for (const collection of data.smartCollections ?? []) {
    add(
      labels.smartCollections,
      collection.uuid,
      collection.name,
      labels.smartCollection,
      {
        to: '/library/smart_collections/$id',
        params: { id: collection.uuid },
      },
      false,
    );
  }

  return out;
}

// With no query, list every page and setting and no entities, which would
// bury them. A query searches everything, capped per group.
export function paletteGroups(
  entries: PaletteEntry[],
  query: string,
): PaletteGroup[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return filterPalette(
      entries.filter((e) => e.browse).map((e) => e.item),
      '',
      Number.POSITIVE_INFINITY,
    );
  }

  return filterPalette(
    entries.map((e) => e.item),
    trimmed,
  );
}

export function searchLibraryTarget(term: string): NavigateOptions {
  const filter = search.makeTitleContainsFilter(term);
  const hasTerm = filter.fieldSpec.value.some((v) => v !== '');
  return hasTerm
    ? { to: '/search', search: { query: search.searchFilterToString(filter) } }
    : { to: '/search' };
}
