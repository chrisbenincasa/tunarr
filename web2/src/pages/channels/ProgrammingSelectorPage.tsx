import { Breadcrumbs, Link, Typography } from '@mui/material';
import { isEmpty, map, reject } from 'lodash-es';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import ProgrammingSelector from '../../components/channel_config/ProgrammingSelector.tsx';
import { useGetRouteName } from '../../hooks/useRouteName.ts';

export default function ProgrammingSelectorPage() {
  const location = useLocation();
  const pathnames = reject(location.pathname.split('/'), isEmpty);
  const getRouteName = useGetRouteName();
  return (
    <>
      <Breadcrumbs sx={{ mb: 2 }} separator="›" aria-label="channel-breadcrumb">
        {map(pathnames, (_, index) => {
          const isLast = index === pathnames.length - 1;
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;
          return isLast ? (
            <Typography color="text.primary" key={to}>
              {getRouteName(to) ?? 'null'}
            </Typography>
          ) : (
            <Link component={RouterLink} to={to} key={to}>
              {getRouteName(to) ?? 'null'}
            </Link>
          );
        })}
      </Breadcrumbs>
      <PaddedPaper>
        <ProgrammingSelector />
      </PaddedPaper>
    </>
  );
}
