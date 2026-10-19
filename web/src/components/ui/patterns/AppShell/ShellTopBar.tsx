import { Trans, useLingui } from '@lingui/react/macro';
import {
  DarkModeOutlined,
  ExpandMore,
  LightModeOutlined,
  Search,
  SettingsOutlined,
} from '@mui/icons-material';
import {
  Box,
  ButtonBase,
  Menu,
  type Theme,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  type ReactNode,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { radiusPill } from '../../../../themeTokens.ts';
import TunarrLogo from '../../../TunarrLogo.tsx';
import { fitTopBar, type TopBarLayout } from './fitTopBar.ts';
import {
  type ActiveNav,
  type ShellNav,
  type ShellNavSection,
  visibleSections,
} from './navModel.ts';
import { NavBadge } from './NavBadge.tsx';
import {
  LinkButtonBase,
  LinkMenuItem,
  LinkShellIconButton,
  ShellIconButton,
} from './shellLinks.ts';

const GroupGap = 24;
const SectionGap = 2;
const ActionGap = 8;
const SearchPillWidth = 240;

export type ShellTopBarProps = {
  nav: ShellNav;
  active: ActiveNav;
  isDark: boolean;
  onToggleColorScheme: () => void;
  onOpenSearch: () => void;
  searchShortcut: string;
  helpMenu: ReactNode;
};

const pillSx = (current: boolean) => (theme: Theme) => ({
  flex: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  height: theme.sizes.navItemHeight,
  px: '13px',
  gap: '6px',
  borderRadius: `${radiusPill}px`,
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  fontWeight: current ? 600 : 500,
  color: current ? theme.palette.text.primary : theme.palette.text.secondary,
  bgcolor: current ? theme.palette.tokens.border : 'transparent',
  '&:hover': {
    bgcolor: theme.palette.tokens.border,
    color: theme.palette.text.primary,
  },
  '&.Mui-focusVisible': {
    outline: `2px solid ${theme.palette.tokens.accent}`,
  },
});

const SectionPill = ({
  section,
  current,
}: {
  section: ShellNavSection;
  current: boolean;
}) => (
  <LinkButtonBase
    to={section.to}
    aria-current={current ? 'page' : undefined}
    sx={pillSx(current)}
  >
    {section.label}
    {section.badge && <NavBadge badge={section.badge} />}
  </LinkButtonBase>
);

const Wordmark = () => (
  <Box
    component="span"
    sx={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}
  >
    Tunarr
  </Box>
);

const SearchPill = ({
  shortcut,
  onClick,
}: {
  shortcut: string;
  onClick?: () => void;
}) => (
  <ButtonBase
    onClick={onClick}
    sx={(theme) => ({
      flex: 'none',
      width: SearchPillWidth,
      height: theme.sizes.navItemHeight,
      px: '12px',
      gap: '10px',
      justifyContent: 'flex-start',
      borderRadius: `${radiusPill}px`,
      border: `1px solid ${theme.palette.tokens.borderStrong}`,
      bgcolor: 'background.paper',
      color: 'text.secondary',
      fontFamily: 'inherit',
      fontSize: 13,
      '&:hover': { bgcolor: 'tokens.surfaceRaised' },
      '&.Mui-focusVisible': {
        outline: `2px solid ${theme.palette.tokens.accent}`,
      },
    })}
  >
    <Search sx={{ fontSize: 16 }} />
    <Trans>Search or jump to…</Trans>
    <Box
      component="kbd"
      sx={(theme) => ({
        ml: 'auto',
        px: '5px',
        fontSize: 11,
        borderRadius: '4px',
        border: `1px solid ${theme.palette.tokens.borderStrong}`,
      })}
    >
      {shortcut}
    </Box>
  </ButtonBase>
);

// Width of everything the bar could show, read from a hidden copy so the
// visible bar can drop parts without losing their measurements.
const useTopBarLayout = (sectionCount: number, activeIndex?: number) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<TopBarLayout>(() => ({
    search: 'full',
    wordmark: true,
    visible: Array.from({ length: sectionCount }, (_, i) => i),
    overflow: [],
  }));

  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    const logo = logoRef.current;
    const actions = actionsRef.current;
    if (!row || !measure || !logo || !actions) {
      return;
    }

    const widthOf = (key: string) =>
      measure.querySelector<HTMLElement>(`[data-measure="${key}"]`)
        ?.offsetWidth ?? 0;

    const compute = () => {
      const style = getComputedStyle(row);
      const available =
        row.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight);
      const next = fitTopBar(
        {
          available,
          logo: logo.offsetWidth,
          wordmark: widthOf('wordmark') + 10,
          sections: Array.from({ length: sectionCount }, (_, i) =>
            widthOf(`section-${i}`),
          ),
          sectionGap: SectionGap,
          more: widthOf('more'),
          searchFull: widthOf('search-full'),
          searchIcon: widthOf('search-icon'),
          actions: actions.offsetWidth,
          actionGap: ActionGap,
          groupGap: GroupGap,
        },
        activeIndex,
      );
      setLayout((prev) =>
        prev.search === next.search &&
        prev.wordmark === next.wordmark &&
        prev.visible.join() === next.visible.join()
          ? prev
          : next,
      );
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(row);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [sectionCount, activeIndex]);

  return { layout, rowRef, logoRef, actionsRef, measureRef };
};

export const ShellTopBar = ({
  nav,
  active,
  isDark,
  onToggleColorScheme,
  onOpenSearch,
  searchShortcut,
  helpMenu,
}: ShellTopBarProps) => {
  const { t } = useLingui();
  const theme = useTheme();
  const moreMenuId = useId();
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);

  const sections = useMemo(() => visibleSections(nav), [nav]);
  const activeIndex = sections.findIndex((s) => s.id === active.sectionId);
  const { layout, rowRef, logoRef, actionsRef, measureRef } = useTopBarLayout(
    sections.length,
    activeIndex >= 0 ? activeIndex : undefined,
  );

  const shown = layout.visible.flatMap((i) => sections[i] ?? []);
  const overflow = layout.overflow.flatMap((i) => sections[i] ?? []);
  const overflowBadge = overflow.find((s) => s.badge)?.badge;
  const anyBadge = sections.find((s) => s.badge)?.badge;
  const settingsCurrent = active.sectionId === nav.settings.id;
  const colorLabel = isDark ? t`Switch to light mode` : t`Switch to dark mode`;

  return (
    <Box
      ref={rowRef}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: `${GroupGap}px`,
        py: `${theme.sizes.shellPaddingY}px`,
        px: `${theme.sizes.shellPaddingX}px`,
        overflow: 'hidden',
      }}
    >
      <LinkButtonBase
        to="/guide"
        aria-label={t`Tunarr home`}
        sx={{ flex: 'none', gap: '10px', borderRadius: 2, color: 'inherit' }}
      >
        <Box ref={logoRef} sx={{ display: 'flex', width: 40, height: 32 }}>
          <TunarrLogo style={{ width: 40, height: 32 }} />
        </Box>
        {layout.wordmark && <Wordmark />}
      </LinkButtonBase>

      <Box
        component="nav"
        aria-label={t`Main`}
        sx={{ flex: 'none', display: 'flex', gap: `${SectionGap}px` }}
      >
        {shown.map((section) => (
          <SectionPill
            key={section.id}
            section={section}
            current={section.id === active.sectionId}
          />
        ))}
        {overflow.length > 0 && (
          <>
            <ButtonBase
              aria-haspopup="menu"
              aria-controls={moreAnchor ? moreMenuId : undefined}
              aria-expanded={moreAnchor ? 'true' : undefined}
              onClick={(e) => setMoreAnchor(e.currentTarget)}
              sx={pillSx(false)}
            >
              <Trans>More</Trans>
              {overflowBadge && <NavBadge badge={overflowBadge} />}
              <ExpandMore sx={{ fontSize: 16 }} />
            </ButtonBase>
            <Menu
              id={moreMenuId}
              anchorEl={moreAnchor}
              open={moreAnchor !== null}
              onClose={() => setMoreAnchor(null)}
              slotProps={{ paper: { sx: { minWidth: 220, mt: 1 } } }}
            >
              {overflow.map((section) => (
                <LinkMenuItem
                  key={section.id}
                  to={section.to}
                  onClick={() => setMoreAnchor(null)}
                  sx={{ gap: 1, justifyContent: 'space-between' }}
                >
                  {section.label}
                  {section.badge && <NavBadge badge={section.badge} />}
                </LinkMenuItem>
              ))}
            </Menu>
          </>
        )}
      </Box>

      <Box
        sx={{
          ml: 'auto',
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: `${ActionGap}px`,
        }}
      >
        {layout.search === 'full' ? (
          <SearchPill shortcut={searchShortcut} onClick={onOpenSearch} />
        ) : (
          <Tooltip title={t`Search (${searchShortcut})`}>
            <ShellIconButton
              aria-label={t`Search or jump to`}
              onClick={onOpenSearch}
            >
              <Search />
            </ShellIconButton>
          </Tooltip>
        )}
        <Box
          ref={actionsRef}
          sx={{ display: 'flex', alignItems: 'center', gap: `${ActionGap}px` }}
        >
          <Tooltip title={colorLabel}>
            <ShellIconButton
              aria-label={colorLabel}
              onClick={onToggleColorScheme}
            >
              {isDark ? <LightModeOutlined /> : <DarkModeOutlined />}
            </ShellIconButton>
          </Tooltip>
          {helpMenu}
          <Tooltip title={nav.settings.label}>
            <LinkShellIconButton
              to={nav.settings.to}
              aria-label={nav.settings.label}
              aria-current={settingsCurrent ? 'page' : undefined}
              current={settingsCurrent}
            >
              <SettingsOutlined />
            </LinkShellIconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box
        ref={measureRef}
        aria-hidden
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 'max-content',
          height: 0,
          overflow: 'hidden',
          visibility: 'hidden',
          display: 'flex',
          pointerEvents: 'none',
        }}
      >
        <Box data-measure="wordmark" sx={{ flex: 'none' }}>
          <Wordmark />
        </Box>
        {sections.map((section, i) => (
          <Box
            key={section.id}
            data-measure={`section-${i}`}
            sx={pillSx(section.id === active.sectionId)}
          >
            {section.label}
            {section.badge && <NavBadge badge={section.badge} />}
          </Box>
        ))}
        <Box data-measure="more" sx={pillSx(false)}>
          <Trans>More</Trans>
          {anyBadge && <NavBadge badge={anyBadge} />}
          <ExpandMore sx={{ fontSize: 16 }} />
        </Box>
        <Box
          data-measure="search-full"
          sx={{ flex: 'none', width: SearchPillWidth }}
        />
        <Box
          data-measure="search-icon"
          sx={{ flex: 'none', width: theme.sizes.navItemHeight }}
        />
      </Box>
    </Box>
  );
};
