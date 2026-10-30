import {
  AppShell,
  resolveActiveNav,
  shortcutLabel,
} from '@/components/ui/patterns/AppShell';
import { useColorScheme } from '@mui/material';
import { useRouterState } from '@tanstack/react-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { CommandPaletteContainer } from './CommandPaletteContainer.tsx';
import { HelpMenuContainer } from './HelpMenuContainer.tsx';
import { useShellNav } from './useShellNav.tsx';

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

export const AppShellContainer = ({ children }: { children?: ReactNode }) => {
  const nav = useShellNav();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = useMemo(
    () => resolveActiveNav(nav, pathname),
    [nav, pathname],
  );
  const { colorScheme, setMode } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'k' &&
        (e.metaKey || e.ctrlKey) &&
        !e.altKey
      ) {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <AppShell
        nav={nav}
        active={active}
        isDark={isDark}
        onToggleColorScheme={() => setMode(isDark ? 'light' : 'dark')}
        onOpenSearch={() => setPaletteOpen(true)}
        searchShortcut={shortcutLabel(isMac)}
        renderHelpMenu={(variant) => <HelpMenuContainer variant={variant} />}
      >
        {children}
      </AppShell>
      <CommandPaletteContainer
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        nav={nav}
      />
    </>
  );
};
