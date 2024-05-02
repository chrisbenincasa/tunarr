import { Box, Paper, Tab, Tabs, Typography } from '@mui/material';
import { isNil } from 'lodash-es';
import {
  Link,
  Outlet,
  PathMatch,
  matchPath,
  useLocation,
} from 'react-router-dom';

const useRouteMatch = (
  patterns: ReadonlyArray<string>,
): PathMatch<string> | undefined => {
  const { pathname } = useLocation();
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = matchPath(pattern, pathname);
    if (!isNil(match)) {
      return match;
    }
  }
  return;
};

export default function SettingsLayout() {
  const routeMatch = useRouteMatch([
    '/settings/general',
    '/settings/xmltv',
    '/settings/ffmpeg',
    '/settings/plex',
    '/settings/hdhr',
    '/settings/tasks',
  ]);
  const currentTab = routeMatch?.pattern?.path;

  return (
    <Box>
      <Typography variant="h3" mb={2}>
        Settings
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={currentTab}
            variant="scrollable"
            allowScrollButtonsMobile
          >
            <Tab
              label="General"
              value="/settings/general"
              to="/settings/general"
              component={Link}
            />
            <Tab
              label="XMLTV"
              value="/settings/xmltv"
              to="/settings/xmltv"
              component={Link}
            />
            <Tab
              label="FFMPEG"
              value="/settings/ffmpeg"
              to="/settings/ffmpeg"
              component={Link}
            />
            <Tab
              label="Plex"
              value="/settings/plex"
              to="/settings/plex"
              component={Link}
            />
            <Tab
              label="HDHR"
              value="/settings/hdhr"
              to="/settings/hdhr"
              component={Link}
            />
            <Tab
              label="Tasks"
              value="/settings/tasks"
              to="/settings/tasks"
              component={Link}
            />
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          <Outlet />
        </Box>
      </Paper>
    </Box>
  );
}
