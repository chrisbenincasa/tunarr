import type {
  ShellNav,
  ShellNavBadge,
} from '@/components/ui/patterns/AppShell';
import { useSystemHealthChecks } from '@/hooks/useSystemHealthChecks.ts';
import useStore from '@/store/index.ts';
import { useLingui } from '@lingui/react/macro';
import {
  Computer,
  Home,
  Settings,
  SettingsRemote,
  Tv,
  VideoLibrary,
} from '@mui/icons-material';
import { countBy } from 'lodash-es';
import { useMemo } from 'react';

const useHealthBadge = (): ShellNavBadge | undefined => {
  const { data: healthChecks } = useSystemHealthChecks();
  return useMemo(() => {
    const bySeverity = countBy(Object.values(healthChecks), ({ type }) => type);
    const errors = bySeverity['error'] ?? 0;
    const warnings = bySeverity['warning'] ?? 0;
    if (errors > 0) {
      return { count: errors, severity: 'error' };
    }
    if (warnings > 0) {
      return { count: warnings, severity: 'warning' };
    }
    return undefined;
  }, [healthChecks]);
};

// The app's navigation tree. A new top-level section, such as Schedules, is
// one more entry in `sections`.
export const useShellNav = (): ShellNav => {
  const { t } = useLingui();
  const showWelcome = useStore((state) => state.theme.showWelcome);
  const healthBadge = useHealthBadge();

  return useMemo<ShellNav>(
    () => ({
      sections: [
        {
          id: 'welcome',
          label: t`Welcome`,
          to: '/welcome',
          icon: <Home />,
          pages: [],
          hidden: !showWelcome,
        },
        {
          id: 'guide',
          label: t`Guide`,
          to: '/guide',
          icon: <Tv />,
          pages: [],
          alsoMatches: ['/'],
        },
        {
          id: 'channels',
          label: t`Channels`,
          to: '/channels',
          icon: <SettingsRemote />,
          pages: [],
        },
        {
          id: 'library',
          label: t`Library`,
          to: '/library',
          icon: <VideoLibrary />,
          pages: [
            {
              id: 'libraries',
              label: t`Libraries`,
              to: '/library',
              exact: true,
              alsoMatches: ['/media_sources'],
            },
            {
              id: 'custom-shows',
              label: t`Custom Shows`,
              to: '/library/custom-shows',
            },
            { id: 'fillers', label: t`Filler Lists`, to: '/library/fillers' },
            {
              id: 'smart-collections',
              label: t`Smart Collections`,
              to: '/library/smart_collections',
            },
            { id: 'trash', label: t`Trash`, to: '/library/trash' },
          ],
        },
        {
          id: 'system',
          label: t`System`,
          to: '/system',
          icon: <Computer />,
          badge: healthBadge,
          pages: [
            { id: 'status', label: t`Status`, to: '/system', exact: true },
            { id: 'tasks', label: t`Tasks`, to: '/system/tasks' },
            { id: 'logs', label: t`Logs`, to: '/system/logs' },
            { id: 'debug', label: t`Debug`, to: '/system/debug' },
            {
              id: 'troubleshoot',
              label: t`Troubleshoot`,
              to: '/system/troubleshoot',
            },
          ],
        },
      ],
      settings: {
        id: 'settings',
        label: t`Settings`,
        to: '/settings/general',
        icon: <Settings />,
        alsoMatches: ['/settings'],
        pages: [
          { id: 'general', label: t`General`, to: '/settings/general' },
          { id: 'sources', label: t`Sources`, to: '/settings/sources' },
          { id: 'xmltv', label: t`XMLTV`, to: '/settings/xmltv' },
          { id: 'ffmpeg', label: t`FFmpeg`, to: '/settings/ffmpeg' },
          { id: 'hdhr', label: t`HDHR`, to: '/settings/hdhr' },
          { id: 'scanner', label: t`Scanner`, to: '/settings/scanner' },
          { id: 'features', label: t`Features`, to: '/settings/features' },
        ],
      },
    }),
    [healthBadge, showWelcome, t],
  );
};
