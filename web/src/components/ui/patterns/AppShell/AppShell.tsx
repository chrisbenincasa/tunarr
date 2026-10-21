import { Box, useMediaQuery, useTheme } from '@mui/material';
import type { ReactNode } from 'react';
import type { ActiveNav, ShellNav } from './navModel.ts';
import {
  PhoneBottomBar,
  PhoneBottomBarHeight,
  PhoneHeader,
} from './PhoneNav.tsx';
import { SectionPages } from './SectionPages.tsx';
import type { ShellIconButtonVariant } from './shellLinks.ts';
import { ShellTopBar } from './ShellTopBar.tsx';

export const AppShellMaxContentWidth = 1360;

export type AppShellProps = {
  nav: ShellNav;
  active: ActiveNav;
  isDark: boolean;
  onToggleColorScheme: () => void;
  onOpenSearch: () => void;
  searchShortcut: string;
  renderHelpMenu: (variant: ShellIconButtonVariant) => ReactNode;
  children?: ReactNode;

  // Picks the layout from the viewport when unset.
  layout?: 'desktop' | 'phone';
};

export const AppShell = ({
  nav,
  active,
  isDark,
  onToggleColorScheme,
  onOpenSearch,
  searchShortcut,
  renderHelpMenu,
  children,
  layout,
}: AppShellProps) => {
  const theme = useTheme();
  const phoneViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const phone = layout === undefined ? phoneViewport : layout === 'phone';

  const section = [...nav.sections, nav.settings].find(
    (s) => s.id === active.sectionId && s.pages.length > 0,
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: theme.zIndex.appBar,
          bgcolor: 'background.default',

          // With a tab row, the divider sits under the tabs instead.
          borderBottom:
            section && !phone ? 0 : `1px solid ${theme.palette.divider}`,
        }}
      >
        {phone ? (
          <PhoneHeader
            isDark={isDark}
            onToggleColorScheme={onToggleColorScheme}
            onOpenSearch={onOpenSearch}
            helpMenu={renderHelpMenu('plain')}
          />
        ) : (
          <ShellTopBar
            nav={nav}
            active={active}
            isDark={isDark}
            onToggleColorScheme={onToggleColorScheme}
            onOpenSearch={onOpenSearch}
            searchShortcut={searchShortcut}
            helpMenu={renderHelpMenu('outlined')}
          />
        )}
      </Box>

      {section && (
        <SectionPages
          section={section}
          activePageId={active.pageId}
          variant={phone ? 'chips' : 'tabs'}
        />
      )}

      <Box
        component="main"
        sx={
          phone
            ? {
                px: '16px',
                pt: '18px',
                pb: `calc(${PhoneBottomBarHeight + 24}px + env(safe-area-inset-bottom))`,
              }
            : {
                maxWidth: AppShellMaxContentWidth,
                mx: 'auto',
                px: `${theme.sizes.pagePaddingX}px`,
                py: `${theme.sizes.pagePaddingY}px`,
              }
        }
      >
        {children}
      </Box>

      {phone && <PhoneBottomBar nav={nav} active={active} />}
    </Box>
  );
};
