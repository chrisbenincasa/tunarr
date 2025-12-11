import DiscordIcon from '@/assets/icon_clyde_black_RGB.svg?react';
import {
  GitHub,
  Link as LinkIcon,
  MoreVert,
  Search as SearchIcon,
  TextSnippet,
} from '@mui/icons-material';
import {
  alpha,
  AppBar,
  Box,
  Button,
  IconButton,
  InputBase,
  Link,
  MenuItem,
  styled,
  SvgIcon,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useMatches } from '@tanstack/react-router';
import { isNonEmptyString } from '@tunarr/shared/util';
import { isEmpty, isNull, last } from 'lodash-es';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard.ts';
import { Route } from '../routes/__root.tsx';
import { useSettings } from '../store/settings/selectors.ts';
import { RouterLink } from './base/RouterLink.tsx';
import { StyledMenu } from './base/StyledMenu.tsx';
import DarkModeButton from './settings/DarkModeButton.tsx';
import TunarrLogo from './TunarrLogo.tsx';

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(1),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  width: '100%',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    // vertical padding + font size from searchIcon
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    [theme.breakpoints.up('sm')]: {
      width: '12ch',
      '&:focus': {
        width: '50ch',
      },
    },
  },
}));

type TopBarNavItem = {
  name: string;
  path: string;
  visible: boolean;
  icon?: ReactNode;
  copyToClipboard?: boolean;
};

export const TopBar = () => {
  const initialSearch = Route.useSearch();
  const navigate = Route.useNavigate();
  const matches = useMatches();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const mobileLinksOpen = !isNull(anchorEl);
  const copyToClipboard = useCopyToClipboard();
  const showSearchBar = useMemo(
    () => !last(matches)?.pathname.startsWith('/search'),
    [matches],
  );

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchQuery, setSearchQuery] = useState(initialSearch?.query ?? '');

  const handleSearchKeyDown: React.KeyboardEventHandler<
    HTMLInputElement | HTMLTextAreaElement
  > = useCallback(
    (e) => {
      if (e.key === 'Enter' && isNonEmptyString(searchQuery)) {
        navigate({
          to: '/search',
          search: { query: searchQuery },
        }).catch(console.error);
      }
    },
    [navigate, searchQuery],
  );

  const handleNavItemLinkClick = useCallback(
    (e: React.SyntheticEvent, navItem: TopBarNavItem) => {
      if (navItem.copyToClipboard) {
        e.preventDefault();
        copyToClipboard(
          navItem.path,
          `Copied ${navItem.name} URL to clipboard`,
        ).catch(console.error);
      }
    },
    [copyToClipboard],
  );

  const settings = useSettings();
  const actualBackendUri = useMemo(
    () =>
      isEmpty(settings.backendUri)
        ? window.location.origin
        : settings.backendUri,
    [settings.backendUri],
  );

  const TopBarLinks = useMemo<TopBarNavItem[]>(
    () => [
      {
        name: 'XMLTV',
        path: `${actualBackendUri}/api/xmltv.xml`,
        visible: true,
        icon: <LinkIcon />,
        copyToClipboard: true,
      },
      {
        name: 'M3U',
        path: `${actualBackendUri}/api/channels.m3u`,
        visible: true,
        icon: <LinkIcon />,
        copyToClipboard: true,
      },
      {
        name: 'GitHub',
        path: 'https://github.com/chrisbenincasa/tunarr',
        visible: true,
        icon: <GitHub />,
      },
      {
        name: 'Discord',
        path: 'https://discord.gg/svgSBYkEK5',
        visible: true,
        icon: (
          <SvgIcon>
            <DiscordIcon />
          </SvgIcon>
        ),
      },
      {
        name: 'Documentation',
        path: 'https://tunarr.com/',
        visible: true,
        icon: <TextSnippet />,
      },
    ],
    [actualBackendUri],
  );

  return (
    <AppBar
      position="fixed"
      sx={{
        p: 0,
        zIndex: (theme) => theme.zIndex.drawer + 1,
        boxShadow: 'none',
      }}
    >
      <Toolbar sx={{ px: 2 }} disableGutters>
        <RouterLink underline="none" color="inherit" to="/guide">
          <TunarrLogo style={{ marginTop: '0.4em', width: '40px' }} />
        </RouterLink>
        <Typography
          variant="h6"
          component="h1"
          noWrap
          color="inherit"
          sx={{ pl: 1 }}
        >
          <RouterLink underline="none" color="inherit" to="/guide">
            Tunarr
          </RouterLink>
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {!smallViewport && showSearchBar && (
          <Search>
            <SearchIconWrapper>
              <SearchIcon />
            </SearchIconWrapper>
            <StyledInputBase
              placeholder="Search…"
              inputProps={{ 'aria-label': 'search' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </Search>
        )}

        <DarkModeButton iconOnly />
        {smallViewport ? (
          <>
            <Button onClick={handleClick} color="inherit">
              <MoreVert />
            </Button>
            <StyledMenu
              slotProps={{
                list: {
                  'aria-labelledby': 'demo-customized-button',
                },
              }}
              anchorEl={anchorEl}
              open={mobileLinksOpen}
              onClose={handleClose}
            >
              {TopBarLinks.map((link) => (
                <MenuItem
                  disableRipple
                  component={Link}
                  href={link.path}
                  target="_blank"
                  color="inherit"
                  sx={{ px: 1, ml: 0.5 }}
                  key={`mobile-${link.name}`}
                  divider={link.name === 'M3U'}
                  onClick={(e) => handleNavItemLinkClick(e, link)}
                >
                  {link.icon} {link.name}
                </MenuItem>
              ))}
            </StyledMenu>
          </>
        ) : (
          <>
            {TopBarLinks.map((link) => {
              return link.name === 'XMLTV' || link.name === 'M3U' ? (
                <Button
                  href={link.path}
                  target="_blank"
                  color="inherit"
                  startIcon={link.icon}
                  sx={{ px: 1, ml: 0.5 }}
                  key={link.name}
                  onClick={(e) => handleNavItemLinkClick(e, link)}
                >
                  {link.name}
                </Button>
              ) : (
                <Tooltip title={link.name} key={link.name}>
                  <IconButton href={link.path} target="_blank" color="inherit">
                    {link.icon}
                  </IconButton>
                </Tooltip>
              );
            })}
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};
