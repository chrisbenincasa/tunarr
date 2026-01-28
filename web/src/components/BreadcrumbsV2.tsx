import type { BreadcrumbsProps } from '@mui/material';
import { Breadcrumbs, Typography } from '@mui/material';
import type { AnyRoute } from '@tanstack/react-router';
import { useRouterState } from '@tanstack/react-router';
import { isNonEmptyString, seq } from '@tunarr/shared/util';
import { useMemo } from 'react';
import { routeTree } from '../routeTree.gen.ts';
import { RouterLink } from './base/RouterLink.tsx';

function walkRouteTree(r: AnyRoute, depth = 0) {
  console.log(depth, r.fullPath, r);
  for (const c of r.children ?? []) {
    walkRouteTree(c, depth + 1);
  }
}

export const BreadcrumbsV2 = (props: BreadcrumbsProps) => {
  const { matches } = useRouterState();
  console.log(walkRouteTree(routeTree));
  const crumbs = useMemo(() => {
    return matches.flatMap(({ pathname, meta }) => {
      return seq.collect(meta, (m) => {
        const title = m?.title;
        if (!isNonEmptyString(title)) {
          return;
        }
        return { title, path: pathname };
      });
    });
  }, [matches]);

  return (
    <Breadcrumbs {...props} sx={props.sx ?? { mb: 2 }}>
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return isLast ? (
          <Typography color="text.primary" key={crumb.title}>
            {crumb.title}
          </Typography>
        ) : (
          <RouterLink to={crumb.path} key={crumb.title}>
            {crumb.title}
          </RouterLink>
        );
      })}
    </Breadcrumbs>
  );
};
