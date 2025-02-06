import {
  BugReport,
  Computer,
  Home,
  LiveTv,
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
        visible: showWelcome,
        icon: <Home />,
      },
      { name: 'Guide', path: '/guide', visible: true, icon: <Tv /> },
      {
        name: 'Channels',
        path: '/channels',
        visible: true,
        icon: <SettingsRemote />,
      },
      { name: 'Watch', path: '/watch', visible: false, icon: <LiveTv /> },
      {
        name: 'Library',
        path: '/library',
        visible: true,
        icon: <VideoLibrary />,
        children: [
          {
            name: 'Filler',
            path: '/library/fillers',
            visible: true,
            icon: <Preview />,
          },
          {
            name: 'Custom Shows',
            path: '/library/custom-shows',
            visible: true,
            icon: <Theaters />,
          },
        ],
      },
      {
        name: 'Settings',
        path: '/settings/general',
        visible: true,
        icon: <Settings />,
      },
      {
        name: 'System',
        path: '/system',
        visible: true,
        icon: <Computer />,
        children: [
          {
            name: 'Debug',
            path: '/system/debug',
            visible: true,
            icon: <BugReport />,
          },
        ],
      },
    ];

    setSelected(items, routerState);

    return items;
  }, [routerState, setSelected, showWelcome]);
};

export interface NavItem {
  name: string;
  path: string;
  visible: boolean;
  children?: NavItem[];
  icon?: ReactNode;
  copyToClipboard?: boolean;
  selected?: boolean;
}
