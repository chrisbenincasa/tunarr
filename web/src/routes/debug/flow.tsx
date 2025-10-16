import { createFileRoute } from '@tanstack/react-router';
import { FlowPage } from '../../pages/debug/FlowPage.tsx';

export const Route = createFileRoute('/debug/flow')({
  component: FlowPage,
});
