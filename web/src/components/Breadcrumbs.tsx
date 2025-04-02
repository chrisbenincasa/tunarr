import type { BreadcrumbsProps } from '@mui/material';
import { Link, Breadcrumbs as MUIBreadcrumbs, Typography } from '@mui/material';
import { Link as RouterLink, useLocation } from '@tanstack/react-router';
import { isEmpty, map, reject } from 'lodash-es';
import { useGetRouteDetails } from '../hooks/useRouteName.ts';

export default function Breadcrumbs(props: BreadcrumbsProps) {
  const { sx = { mb: 2 }, separator = '›', ...restProps } = props;

  const location = useLocation();
  // TODO Hard code this somewhere else
  const pathnames = reject(
    reject(location.pathname.split('/'), isEmpty),
    (part) => part === 'web',
  );
  const getRoute = useGetRouteDetails();

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
          const route = getRoute(to);

          if (!route?.name) {
            return null;
          }

          // Don't link the last item in a breadcrumb because you are on that page
          // Don't display crumbs for pages that aren't excplicely defined in useRouteNames hook
          return isLast || !route?.isLink ? (
            <Typography color="text.primary" key={to}>
              {route.name ?? ''}
            </Typography>
          ) : (
            <Link component={RouterLink} to={to} key={to}>
              {route.name}
            </Link>
          );
        })}
      </MUIBreadcrumbs>
    </>
  );
}
