import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/library/custom-shows/new')({
  component: () => <div>Hello /settings/library/custom-shows/new!</div>
})