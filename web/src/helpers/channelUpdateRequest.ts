import type { SaveableChannel, UpdateChannelRequest } from '@tunarr/types';

/**
 * Sends startTime only when the user changed it. The server may rebase
 * startTime while the form is open, and resending the loaded value would
 * revert that rebase.
 */
export function toChannelUpdateRequest(
  channel: SaveableChannel,
  loadedStartTime: number | undefined,
): UpdateChannelRequest {
  if (channel.startTime !== loadedStartTime) {
    return channel;
  }

  const { startTime: _, ...rest } = channel;
  return rest;
}
