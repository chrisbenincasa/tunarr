import {
  CommandPalette,
  filterPalette,
  type PaletteItem,
  type ShellNav,
} from '@/components/ui/patterns/AppShell';
import {
  getApiSmartCollectionsOptions,
  getChannelsOptions,
} from '@/generated/@tanstack/react-query.gen.ts';
import { customShowsQuery } from '@/hooks/useCustomShows.ts';
import { fillerListsQuery } from '@/hooks/useFillerLists.ts';
import { useLingui } from '@lingui/react/macro';
import { useQuery } from '@tanstack/react-query';
import { type NavigateOptions, useNavigate } from '@tanstack/react-router';
import { search } from '@tunarr/shared/util';
import { useMemo, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  nav: ShellNav;
};

type Entry = { item: PaletteItem; go: NavigateOptions };

export const CommandPaletteContainer = ({ open, onClose, nav }: Props) => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const channels = useQuery({ ...getChannelsOptions(), enabled: open });
  const customShows = useQuery({ ...customShowsQuery(), enabled: open });
  const fillers = useQuery({ ...fillerListsQuery(), enabled: open });
  const smartCollections = useQuery({
    ...getApiSmartCollectionsOptions(),
    enabled: open,
  });

  const entries = useMemo(() => {
    const out: Entry[] = [];
    const add = (
      group: string,
      id: string,
      label: string,
      kind: string,
      go: NavigateOptions,
      number?: string,
    ) =>
      out.push({
        item: { id: `${group}:${id}`, group, label, kind, number },
        go,
      });

    const pages = t`Pages`;
    for (const section of nav.sections.filter((s) => !s.hidden)) {
      if (section.pages.length === 0) {
        add(pages, section.id, section.label, t`Page`, { to: section.to });
      }
      for (const page of section.pages) {
        add(pages, `${section.id}/${page.id}`, page.label, section.label, {
          to: page.to,
        });
      }
    }

    const settings = nav.settings.label;
    for (const page of nav.settings.pages) {
      add(settings, page.id, page.label, settings, { to: page.to });
    }

    const channelGroup = t`Channels`;
    for (const channel of channels.data ?? []) {
      add(
        channelGroup,
        channel.id,
        channel.name,
        t`Channel`,
        { to: '/channels/$channelId', params: { channelId: channel.id } },
        channel.number.toString(),
      );
    }

    const showGroup = t`Custom Shows`;
    for (const show of customShows.data ?? []) {
      add(showGroup, show.id, show.name, t`Custom show`, {
        to: '/library/custom-shows/$showId/edit',
        params: { showId: show.id },
      });
    }

    const fillerGroup = t`Filler Lists`;
    for (const filler of fillers.data ?? []) {
      add(fillerGroup, filler.id, filler.name, t`Filler list`, {
        to: '/library/fillers/$fillerId/edit',
        params: { fillerId: filler.id },
      });
    }

    const collectionGroup = t`Smart Collections`;
    for (const collection of smartCollections.data ?? []) {
      add(
        collectionGroup,
        collection.uuid,
        collection.name,
        t`Smart collection`,
        {
          to: '/library/smart_collections/$id',
          params: { id: collection.uuid },
        },
      );
    }

    return out;
  }, [
    nav,
    channels.data,
    customShows.data,
    fillers.data,
    smartCollections.data,
    t,
  ]);

  const groups = useMemo(() => {
    const trimmed = query.trim();

    // With no query, list only pages and settings. Entities would bury them.
    const pool =
      trimmed.length === 0
        ? entries.filter(
            (e) =>
              e.item.group === t`Pages` || e.item.group === nav.settings.label,
          )
        : entries;
    return filterPalette(
      pool.map((e) => e.item),
      trimmed,
      trimmed.length === 0 ? Number.POSITIVE_INFINITY : undefined,
    );
  }, [entries, nav.settings.label, query, t]);

  const close = () => {
    setQuery('');
    onClose();
  };

  const go = (options: NavigateOptions) => {
    close();
    navigate(options).catch(console.error);
  };

  return (
    <CommandPalette
      open={open}
      onClose={close}
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      loading={
        channels.isPending ||
        customShows.isPending ||
        fillers.isPending ||
        smartCollections.isPending
      }
      onSelect={(item) => {
        const entry = entries.find((e) => e.item.id === item.id);
        if (entry) {
          go(entry.go);
        }
      }}
      onSearchLibrary={(term) => {
        const filter = search.makeTitleContainsFilter(term);
        const hasTerm = filter.fieldSpec.value.some((v) => v !== '');
        go(
          hasTerm
            ? {
                to: '/search',
                search: { query: search.searchFilterToString(filter) },
              }
            : { to: '/search' },
        );
      }}
    />
  );
};
