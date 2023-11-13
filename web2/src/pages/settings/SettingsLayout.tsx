import { Box, Tab, Tabs } from '@mui/material';
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
  const routeMatch = useRouteMatch(['/settings/xmltv', '/settings/ffmpeg']);
  const currentTab = routeMatch?.pattern?.path;

  return (
    <div>
      <h1>Settings</h1>
      <Tabs value={currentTab}>
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
      </Tabs>
      <Box sx={{ p: 3 }}>
        <Outlet />
      </Box>
    </div>
  );
}
