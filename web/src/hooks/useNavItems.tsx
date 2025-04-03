import {
  BugReport,
  Computer,
  Home,
  InfoOutlined,
  LiveTv,
  Notes,
  Preview,
  Settings,
  SettingsRemote,
  Theaters,
  Tv,
  VideoLibrary,
} from '@mui/icons-material';
import { useRouterState } from '@tanstack/react-router';
import { last, trimEnd } from 'lodash-es';
import { useCallback, useMemo, type ReactNode } from 'react';
import useStore from '../store/index.ts';

export const useNavItems = () => {
  const showWelcome = useStore((state) => state.theme.showWelcome);
  const routerState = useRouterState({
    select: ({ matches }) => trimEnd(last(matches)?.fullPath ?? '', '/'),
  });

  const setSelected = useCallback(
    (navItems: NavItem[], currentRoute: string | undefined) => {
      for (const item of navItems) {
        item.selected = item.path === currentRoute;
        if (item.children) {
          setSelected(item.children, currentRoute);
        }
      }
    },
    [],
  );

  return useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      {
        name: 'Welcome',
        path: '/welcome',
        hidden: !showWelcome,
        icon: <Home />,
      },
      { name: 'Guide', path: '/guide', icon: <Tv /> },
      {
        name: 'Channels',
        path: '/channels',
        icon: <SettingsRemote />,
      },
      { name: 'Watch', path: '/watch', hidden: true, icon: <LiveTv /> },
      {
        name: 'Library',
        path: '/library',
        icon: <VideoLibrary />,
        children: [
          {
            name: 'Filler',
            path: '/library/fillers',
            icon: <Preview />,
          },
          {
            name: 'Custom Shows',
            path: '/library/custom-shows',
            icon: <Theaters />,
          },
        ],
      },
      {
        name: 'System',
        path: '/system',
        icon: <Computer />,
        children: [
          {
            name: 'Status',
            path: '/system/status',
            icon: <InfoOutlined />,
          },
          {
            name: 'Debug',
            path: '/system/debug',
            icon: <BugReport />,
          },
          {
            name: 'Logs',
            path: '/system/logs',
            icon: <Notes />,
          },
        ],
      },
      {
        name: 'Settings',
        path: '/settings/general',
        icon: <Settings />,
      },
    ];

    setSelected(items, routerState);

    return items;
  }, [routerState, setSelected, showWelcome]);
};

export interface NavItem {
  name: string;
  path: string;
  hidden?: boolean;
  children?: NavItem[];
  icon?: ReactNode;
  copyToClipboard?: boolean;
  selected?: boolean;
}
