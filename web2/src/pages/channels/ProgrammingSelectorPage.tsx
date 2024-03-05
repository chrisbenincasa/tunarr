import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import ProgrammingSelector from '../../components/channel_config/ProgrammingSelector.tsx';

export default function ProgrammingSelectorPage() {
  return (
    <>
      <Breadcrumbs />
      <PaddedPaper>
        <ProgrammingSelector />
      </PaddedPaper>
    </>
  );
}
