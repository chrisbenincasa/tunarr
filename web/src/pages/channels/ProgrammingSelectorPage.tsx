import { isEmpty, reject } from 'lodash-es';
import { useLocation } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import ProgrammingSelector from '../../components/channel_config/ProgrammingSelector.tsx';
import { useGetRouteName } from '../../hooks/useRouteName.ts';

export default function ProgrammingSelectorPage() {
  const location = useLocation();
  const pathnames = reject(location.pathname.split('/'), isEmpty);
  const getRouteName = useGetRouteName();

  return (
    <>
      <Breadcrumbs />
      <PaddedPaper>
        <ProgrammingSelector />
      </PaddedPaper>
    </>
  );
}
