import {
  CommandPalette,
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
import { useMemo, useState } from 'react';
import {
  buildPaletteEntries,
  paletteGroups,
  searchLibraryTarget,
} from './paletteEntries.ts';

type Props = {
  open: boolean;
  onClose: () => void;
  nav: ShellNav;
};

export const CommandPaletteContainer = ({ open, onClose, nav }: Props) => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  // Clear the query on every close, including the ⌘K toggle.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setQuery('');
    }
  }

  const channels = useQuery({ ...getChannelsOptions(), enabled: open });
  const customShows = useQuery({ ...customShowsQuery(), enabled: open });
  const fillers = useQuery({ ...fillerListsQuery(), enabled: open });
  const smartCollections = useQuery({
    ...getApiSmartCollectionsOptions(),
    enabled: open,
  });

  const entries = useMemo(
    () =>
      buildPaletteEntries(
        nav,
        {
          pages: t`Pages`,
          page: t`Page`,
          channels: t`Channels`,
          channel: t`Channel`,
          customShows: t`Custom Shows`,
          customShow: t`Custom show`,
          fillerLists: t`Filler Lists`,
          fillerList: t`Filler list`,
          smartCollections: t`Smart Collections`,
          smartCollection: t`Smart collection`,
        },
        {
          channels: channels.data,
          customShows: customShows.data,
          fillers: fillers.data,
          smartCollections: smartCollections.data,
        },
      ),
    [
      nav,
      channels.data,
      customShows.data,
      fillers.data,
      smartCollections.data,
      t,
    ],
  );

  const groups = useMemo(() => paletteGroups(entries, query), [entries, query]);

  const go = (options: NavigateOptions) => {
    onClose();
    navigate(options).catch(console.error);
  };

  return (
    <CommandPalette
      open={open}
      onClose={onClose}
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
      onSearchLibrary={(term) => go(searchLibraryTarget(term))}
    />
  );
};
