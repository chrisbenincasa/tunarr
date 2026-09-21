import { inject, injectable } from 'inversify';
import { z } from 'zod/v4';
import type { IChannelDB } from '../db/interfaces/IChannelDB.ts';
import { EtvNextDynamicTokenRegistry } from '../stream/etv/EtvNextDynamicTokenRegistry.ts';
import { parseBearerToken } from '../stream/etv/EtvNextDynamicTokenRegistry.ts';
import { StreamTerminationRequestedError } from '../stream/etv/EtvNextPlayoutItemMapper.ts';
import { EtvNextPlayoutWriter } from '../stream/etv/EtvNextPlayoutWriter.ts';
import { PlayoutItemSchema } from '../stream/etv/generated/playout.ts';
import { KEYS } from '../types/inject.ts';
import type { RouterPluginAsyncCallback } from '../types/serverType.js';
import type { Maybe } from '../types/util.ts';
import { InjectLogger } from '../util/inject.ts';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import type { ApiController } from './ApiController.ts';

/** Reads one header value, ignoring a duplicate the worker never sends. */
function singleHeader(value: string | string[] | undefined): Maybe<string> {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * RFC3339, which is the whole of what the worker sends and far less than
 * `Date.parse` takes. `Date.parse('5')` yields a valid instant two decades off,
 * and an expanded year renders back as a timestamp the playout schema rejects.
 */
const Rfc3339Pattern =
  /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

/**
 * How far from wall clock a header instant may sit.
 *
 * The transcode position leads by seconds and `x-etv-until` by the dynamic
 * window's depth, so anything past a couple of days is a bad header rather
 * than a schedule.
 */
const MaxInstantSkewMs = 2 * 24 * 60 * 60 * 1000;

/** Parses an RFC3339 instant the worker sent, or nothing when it is unusable. */
function parseInstant(value: Maybe<string>, nowMs: number): Maybe<number> {
  if (value === undefined || !Rfc3339Pattern.test(value)) {
    return undefined;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed) || Math.abs(parsed - nowMs) > MaxInstantSkewMs) {
    return undefined;
  }

  return parsed;
}

/**
 * The callback an `ersatztv-channel` worker resolves its dynamic placeholder
 * against.
 *
 * One request, one item. The worker asks each time it reaches the end of what
 * it is transcoding, so this is where Tunarr keeps its scheduler — filler
 * picking, on-demand cursors, redirects and error degradation all stay on this
 * side and none of it has to be predicted hours ahead.
 */
@injectable()
export class EtvNextApiController implements ApiController {
  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(EtvNextDynamicTokenRegistry)
    private tokenRegistry: EtvNextDynamicTokenRegistry,
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(EtvNextPlayoutWriter) private playoutWriter: EtvNextPlayoutWriter,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  mount: RouterPluginAsyncCallback = async (fastify) => {
    fastify.get(
      '/etv/playout-item',
      {
        schema: {
          tags: ['Streaming'],
          description:
            'Resolves the next item for an ErsatzTV next worker. Authenticated with the per-session bearer token the worker is spawned with.',
          response: {
            200: PlayoutItemSchema,
            401: z.void(),
            404: z.void(),
            503: z.void(),
          },
        },
        config: {
          // Tunarr's own basic auth would reject the worker, which speaks the
          // per-session bearer token below and nothing else.
          authRequired: false,
        },
      },
      async (req, res) => {
        const grant = this.tokenRegistry.resolve(
          parseBearerToken(singleHeader(req.headers.authorization)),
        );

        if (grant === undefined) {
          this.logger.warn(
            'Rejected an ErsatzTV next playout callback from %s with no valid session token',
            req.ip,
          );
          return res.status(401).send();
        }

        // The channel comes from the token, never from the header. A worker
        // that names someone else's channel gets its own.
        const requestedNumber = Number.parseInt(
          singleHeader(req.headers['x-etv-channel']) ?? '',
          10,
        );
        if (
          !Number.isNaN(requestedNumber) &&
          requestedNumber !== grant.channelNumber
        ) {
          this.logger.warn(
            'An ErsatzTV next worker holding channel %d asked about channel %d. Answering for the channel its token grants.',
            grant.channelNumber,
            requestedNumber,
          );
        }

        const channel = await this.channelDB.getChannelOrm(grant.channelUuid);
        if (channel === undefined) {
          this.logger.error(
            'An ErsatzTV next worker is streaming channel %s, which no longer exists',
            grant.channelUuid,
          );
          return res.status(404).send();
        }

        const wallClockMs = Date.now();

        // The transcode position runs up to 44s ahead of wall clock. Losing it
        // to a malformed header costs a seam, so wall clock stands in.
        const nowMs = parseInstant(
          singleHeader(req.headers['x-etv-now']),
          wallClockMs,
        );
        if (nowMs === undefined) {
          this.logger.warn(
            'An ErsatzTV next worker on channel %s sent no usable transcode position (%s). Falling back to wall clock.',
            grant.channelUuid,
            singleHeader(req.headers['x-etv-now']) ?? 'no header',
          );
        }

        const untilHeader = singleHeader(req.headers['x-etv-until']);
        const untilMs = parseInstant(untilHeader, wallClockMs);
        if (untilHeader !== undefined && untilMs === undefined) {
          this.logger.warn(
            'An ErsatzTV next worker on channel %s sent an unusable window end (%s). Ignoring it.',
            grant.channelUuid,
            untilHeader,
          );
        }

        try {
          const { item, ignored } = await this.playoutWriter.resolveDynamicItem(
            {
              channel,
              startMs: nowMs ?? wallClockMs,
              untilMs,
            },
          );

          if (ignored.length > 0) {
            this.logger.debug(
              'Resolved a playout item for channel %s with caveats: %s',
              grant.channelUuid,
              ignored.join('; '),
            );
          }

          return res.send(item);
        } catch (e) {
          if (!(e instanceof StreamTerminationRequestedError)) {
            throw e;
          }

          // The channel's error screen is 'kill', so it wants the stream over
          // rather than a picture on it.
          this.logger.error(
            'Channel %s asked for its stream to end (%s). Stopping the worker.',
            grant.channelUuid,
            e.reason,
          );

          req.serverCtx.sessionManager
            .getEtvNextSession(grant.channelUuid)
            ?.stop()
            .catch((stopError: unknown) => {
              this.logger.error(
                stopError,
                'Could not stop the session after the channel asked for termination',
              );
            });

          return res.status(503).send();
        }
      },
    );
  };
}
