import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/library/$id/edit')({
  component: () => <div>Hello /settings/library/$id/edit!</div>
})