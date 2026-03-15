import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { BasicIdParamSchema } from '@tunarr/types/api';
import { isNil } from 'lodash-es';
import z from 'zod/v4';
import type { StreamLineupItem } from '../db/derived_types/StreamLineup.ts';
import {
  isContentBackedLineupItem,
  isOfflineLineupItem,
} from '../db/derived_types/StreamLineup.ts';

const NativePlaybackContentItemSchema = z.object({
  kind: z.literal('content'),
  itemStartedAtMs: z.number().int(),
  seekOffsetMs: z.number().int(),
  remainingMs: z.number().int(),
  programId: z.string().uuid(),
  title: z.string(),
  episodeTitle: z.string().optional(),
  seasonNumber: z.number().int().optional(),
  episodeNumber: z.number().int().optional(),
  summary: z.string().optional(),
  thumb: z.string().optional(),
  streamUrl: z.string(),
});

const NativePlaybackFlexItemSchema = z.object({
  kind: z.literal('flex'),
  remainingMs: z.number().int(),
  itemStartedAtMs: z.number().int(),
});

const NativePlaybackErrorItemSchema = z.object({
  kind: z.literal('error'),
  message: z.string(),
  retryAfterMs: z.number().int(),
});

const NativePlaybackItemSchema = z.discriminatedUnion('kind', [
  NativePlaybackContentItemSchema,
  NativePlaybackFlexItemSchema,
  NativePlaybackErrorItemSchema,
]);

const NativePlaybackResponseSchema = z.object({
  channelId: z.string().uuid(),
  channelNumber: z.number().int(),
  channelName: z.string(),
  serverTimeMs: z.number().int(),
  current: NativePlaybackItemSchema,
  next: NativePlaybackItemSchema.optional(),
});

type NativePlaybackItem = z.infer<typeof NativePlaybackItemSchema>;

function buildStreamUrl(
  baseUrl: string,
  channelId: string,
  itemStartedAtMs: number,
): string {
  return `${baseUrl}/stream/channels/${channelId}/item-stream.ts?t=${itemStartedAtMs}`;
}

export function mapLineupItemToPlaybackItem(
  lineupItem: StreamLineupItem,
  baseUrl: string,
  channelId: string,
): NativePlaybackItem {
  const remainingMs = lineupItem.streamDuration;
  const itemStartedAtMs = lineupItem.programBeginMs;

  if (isOfflineLineupItem(lineupItem)) {
    return {
      kind: 'flex',
      remainingMs,
      itemStartedAtMs,
    };
  }

  if (isContentBackedLineupItem(lineupItem)) {
    const program = lineupItem.program;
    return {
      kind: 'content',
      itemStartedAtMs,
      seekOffsetMs: lineupItem.startOffset ?? 0,
      remainingMs,
      programId: program.uuid,
      // For TV episodes: show title is the primary title, episode title is secondary
      // For movies: program title is the primary title
      title: program.showTitle ?? program.title,
      episodeTitle: program.showTitle ? program.title : undefined,
      seasonNumber: program.seasonNumber ?? undefined,
      episodeNumber: program.episode ?? undefined,
      summary: program.summary ?? undefined,
      thumb: program.icon ?? undefined,
      streamUrl: buildStreamUrl(baseUrl, channelId, itemStartedAtMs),
    };
  }

  // error or redirect items fall through as flex
  return {
    kind: 'flex',
    remainingMs: lineupItem.streamDuration,
    itemStartedAtMs: lineupItem.programBeginMs,
  };
}

// eslint-disable-next-line @typescript-eslint/require-await
export const nativePlaybackApi: RouterPluginAsyncCallback = async (fastify) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'NativePlaybackApi',
  });

  fastify.addHook('onError', (req, _, error, done) => {
    logger.error(
      error,
      'Error in NativePlaybackApi: %s %s',
      req.method,
      req.url,
    );
    done();
  });

  fastify.get(
    '/channels/:id/native-playback',
    {
      schema: {
        tags: ['Native'],
        description:
          'Returns current and next playback items for native client players (tvOS, Android TV). Includes timing data for live TV simulation.',
        params: BasicIdParamSchema,
        response: {
          200: NativePlaybackResponseSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannelOrm(
        req.params.id,
      );

      if (isNil(channel)) {
        return res.status(404).send();
      }

      const now = Date.now();
      const baseUrl = `${req.protocol}://${req.host}`;
      const calculator = req.serverCtx.streamProgramCalculator;

      const currentResult = await calculator.getCurrentLineupItem({
        channelId: channel.uuid,
        startTime: now,
        allowSkip: false,
      });

      if (currentResult.isFailure()) {
        logger.error(
          currentResult.error,
          'Failed to get current lineup item for channel %s',
          channel.uuid,
        );
        return res.status(200).send({
          channelId: channel.uuid,
          channelNumber: channel.number,
          channelName: channel.name,
          serverTimeMs: now,
          current: {
            kind: 'error',
            message:
              currentResult.error.message ??
              'Unable to determine current program',
            retryAfterMs: 5000,
          },
        });
      }

      const currentLineupItem = currentResult.get().lineupItem;
      const current = mapLineupItemToPlaybackItem(
        currentLineupItem,
        baseUrl,
        channel.uuid,
      );

      // Fetch next item
      const nextStartTime = now + currentLineupItem.streamDuration + 1;
      const nextResult = await calculator.getCurrentLineupItem({
        channelId: channel.uuid,
        startTime: nextStartTime,
        allowSkip: false,
      });

      let next: NativePlaybackItem | undefined;
      if (nextResult.isSuccess()) {
        const nextLineupItem = nextResult.get().lineupItem;
        next = mapLineupItemToPlaybackItem(
          nextLineupItem,
          baseUrl,
          channel.uuid,
        );
      }

      return res.status(200).send({
        channelId: channel.uuid,
        channelNumber: channel.number,
        channelName: channel.name,
        serverTimeMs: now,
        current,
        next,
      });
    },
  );
};
