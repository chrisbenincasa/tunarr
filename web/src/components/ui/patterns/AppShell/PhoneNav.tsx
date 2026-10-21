import { Trans, useLingui } from '@lingui/react/macro';
import {
  DarkModeOutlined,
  LightModeOutlined,
  MoreHoriz,
  Search,
} from '@mui/icons-material';
import {
  Badge,
  Box,
  ButtonBase,
  ListItemIcon,
  ListItemText,
  Menu,
  type Theme,
} from '@mui/material';
import { type ReactNode, useId, useState } from 'react';
import TunarrLogo from '../../../TunarrLogo.tsx';
import {
  type ActiveNav,
  type ShellNav,
  type ShellNavSection,
  visibleSections,
  sectionAriaCurrent,
  worstBadgeSeverity,
} from './navModel.ts';
import { LinkButtonBase, LinkMenuItem, ShellIconButton } from './shellLinks.ts';

export const PhoneBottomBarHeight = 64;
const MaxBottomItems = 5;

export type PhoneHeaderProps = {
  isDark: boolean;
  onToggleColorScheme: () => void;
  onOpenSearch: () => void;
  helpMenu: ReactNode;
};

export const PhoneHeader = ({
  isDark,
  onToggleColorScheme,
  onOpenSearch,
  helpMenu,
}: PhoneHeaderProps) => {
  const { t } = useLingui();
  const colorLabel = isDark ? t`Switch to light mode` : t`Switch to dark mode`;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        height: 56,
        pl: '16px',
        pr: '8px',
      }}
    >
      <LinkButtonBase
        to="/guide"
        aria-label={t`Tunarr home`}
        sx={{ gap: '8px', borderRadius: 2, color: 'inherit' }}
      >
        <TunarrLogo style={{ width: 36, height: 29 }} />
        <Box component="span" sx={{ fontSize: 18, fontWeight: 700 }}>
          Tunarr
        </Box>
      </LinkButtonBase>
      <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
        <ShellIconButton
          variant="plain"
          aria-label={t`Search or jump to`}
          onClick={onOpenSearch}
        >
          <Search />
        </ShellIconButton>
        <ShellIconButton
          variant="plain"
          aria-label={colorLabel}
          onClick={onToggleColorScheme}
        >
          {isDark ? <LightModeOutlined /> : <DarkModeOutlined />}
        </ShellIconButton>
        {helpMenu}
      </Box>
    </Box>
  );
};

const itemSx = (current: boolean) => (theme: Theme) => ({
  flex: 1,
  minWidth: 0,
  flexDirection: 'column',
  gap: '4px',
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: current ? 700 : 500,
  color: current ? theme.palette.tokens.accent : theme.palette.text.secondary,
  '& svg': { fontSize: 22 },
  '&.Mui-focusVisible': {
    outline: `2px solid ${theme.palette.tokens.accent}`,
    outlineOffset: -4,
  },
});

const ItemIcon = ({ section }: { section: ShellNavSection }) =>
  section.badge ? (
    <Badge
      badgeContent={section.badge.count}
      color={section.badge.severity}
      sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}
    >
      {section.icon}
    </Badge>
  ) : (
    section.icon
  );

const ItemLabel = ({ children }: { children: ReactNode }) => (
  <Box
    component="span"
    sx={{
      maxWidth: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      px: '2px',
    }}
  >
    {children}
  </Box>
);

export type PhoneBottomBarProps = {
  nav: ShellNav;
  active: ActiveNav;
};

// Five items fit. With a sixth, the last items move under More.
export const PhoneBottomBar = ({ nav, active }: PhoneBottomBarProps) => {
  const { t } = useLingui();
  const menuId = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const items = [...visibleSections(nav), nav.settings];
  const overflowing = items.length > MaxBottomItems;
  const shown = overflowing ? items.slice(0, MaxBottomItems - 1) : items;
  const overflow = overflowing ? items.slice(MaxBottomItems - 1) : [];
  const moreBadge = worstBadgeSeverity(overflow);
  const moreCurrent = overflow.some((s) => s.id === active.sectionId);

  return (
    <Box
      component="nav"
      aria-label={t`Main`}
      sx={(theme) => ({
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: theme.zIndex.appBar,
        display: 'flex',
        height: PhoneBottomBarHeight,
        pb: 'env(safe-area-inset-bottom)',
        boxSizing: 'content-box',
        borderTop: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
      })}
    >
      {shown.map((section) => {
        const current = section.id === active.sectionId;
        return (
          <LinkButtonBase
            key={section.id}
            to={section.to}
            aria-current={sectionAriaCurrent(section, current)}
            sx={itemSx(current)}
          >
            <ItemIcon section={section} />
            <ItemLabel>{section.label}</ItemLabel>
          </LinkButtonBase>
        );
      })}
      {overflowing && (
        <>
          <ButtonBase
            aria-haspopup="menu"
            aria-controls={anchor ? menuId : undefined}
            aria-expanded={anchor ? 'true' : undefined}
            onClick={(e) => setAnchor(e.currentTarget)}
            sx={itemSx(moreCurrent)}
          >
            <Badge
              variant="dot"
              color={moreBadge ?? 'error'}
              invisible={moreBadge === undefined}
            >
              <MoreHoriz />
            </Badge>
            <ItemLabel>
              <Trans>More</Trans>
            </ItemLabel>
          </ButtonBase>
          <Menu
            id={menuId}
            anchorEl={anchor}
            open={anchor !== null}
            onClose={() => setAnchor(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            slotProps={{ paper: { sx: { minWidth: 200, mb: 1 } } }}
          >
            {overflow.map((section) => (
              <LinkMenuItem
                key={section.id}
                to={section.to}
                selected={section.id === active.sectionId}
                onClick={() => setAnchor(null)}
              >
                <ListItemIcon>
                  <ItemIcon section={section} />
                </ListItemIcon>
                <ListItemText>{section.label}</ListItemText>
              </LinkMenuItem>
            ))}
          </Menu>
        </>
      )}
    </Box>
  );
};
