import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/channels/$channelId/programming/time-slot-editor')({
  component: () => <div>Hello /channels/$channelId/programming/time-slot-editor!</div>
})