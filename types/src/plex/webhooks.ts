import { z } from 'zod';

// Extend with Metadata value in the main file... once we better organize
// the schemas here we can split files
export const PlexWebhookBasePayloadSchema = z.object({
  event: z.union([
    z.literal('library.on.deck'),
    z.literal('library.new'),
    z.literal('media.pause'),
    z.literal('media.play'),
    z.literal('media.rate'),
    z.literal('media.resume'),
    z.literal('media.scrobble'),
    z.literal('media.stop'),
    // We don't care about the server owner events, at the momen
  ]),
  user: z.boolean(),
  owner: z.boolean(),
  Account: z.object({
    id: z.number(),
    thumb: z.string(),
    title: z.string(),
  }),
  Server: z.object({
    title: z.string(), // Name
    uuid: z.string(), // 'client_identifier'
  }),
  Player: z
    .object({
      local: z.boolean(),
      publicAddress: z.string(),
      title: z.string(),
      uuid: z.string(),
    })
    .optional(), // Only defined on play events
});
