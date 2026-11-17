import { createFileRoute } from '@tanstack/react-router';
import TranscodeConfigPage from '../../../pages/profiles/TranscodeConfigPage.tsx';

export const Route = createFileRoute('/profiles/transcode_/$configId')({
  component: RouteComponent,
});

function RouteComponent() {
  const { configId } = Route.useParams();
  return <TranscodeConfigPage configId={configId} />;
}
