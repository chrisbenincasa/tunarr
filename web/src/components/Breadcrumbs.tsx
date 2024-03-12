import {
  BreadcrumbsProps,
  Link,
  Breadcrumbs as MUIBreadcrumbs,
  Typography,
} from '@mui/material';
import { isEmpty, map, reject } from 'lodash-es';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useGetRouteName } from '../hooks/useRouteName.ts';

export default function Breadcrumbs(props: BreadcrumbsProps) {
  const { sx = { mb: 2 }, separator = '›', ...restProps } = props;

  const location = useLocation();
  const pathnames = reject(location.pathname.split('/'), isEmpty);
  const getRouteName = useGetRouteName();

  return (
    <>
      <MUIBreadcrumbs
        sx={sx}
        separator={separator}
        aria-label="channel-breadcrumbs"
        {...restProps}
      >
        {map(pathnames, (_, index) => {
          const isLast = index === pathnames.length - 1;
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;

          // Don't link the last item in a breadcrumb because you are on that page
          // Don't display crumbs for pages that aren't excplicely defined in useRouteNames hook
          return isLast ? (
            <Typography color="text.primary" key={to}>
              {getRouteName(to) ?? ''}
            </Typography>
          ) : getRouteName(to) ? (
            <Link component={RouterLink} to={to} key={to}>
              {getRouteName(to)}
            </Link>
          ) : null;
        })}
      </MUIBreadcrumbs>
    </>
  );
}
