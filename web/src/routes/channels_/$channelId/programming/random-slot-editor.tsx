import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/channels/$channelId/programming/random-slot-editor')({
  component: () => <div>Hello /channels/$channelId/programming/random-slot-editor!</div>
})