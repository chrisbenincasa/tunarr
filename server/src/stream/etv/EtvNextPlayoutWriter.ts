import { inject, injectable } from 'inversify';
import { MediaSourceDB } from '../../db/mediaSourceDB.ts';
import type {
  ContentBackedStreamLineupItem,
  StreamLineupItem,
} from '../../db/derived_types/StreamLineup.ts';
import { isContentBackedLineupItem } from '../../db/derived_types/StreamLineup.ts';
import type { ChannelOrmWithTranscodeConfig } from '../../db/schema/derivedTypes.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import { OnDemandChannelService } from '../../services/OnDemandChannelService.ts';
import { ProgramStreamDetailsFetcher } from '../ProgramStreamDetailsFetcher.ts';
import { StreamProgramCalculator } from '../StreamProgramCalculator.ts';
import type { StreamDetails, StreamSource } from '../types.ts';
import { makeLocalUrl } from '../../util/serverUtil.ts';
import type { PlayoutItemMapping } from './EtvNextPlayoutItemMapper.ts';
import {
  rfc3339,
  StreamTerminationRequestedError,
  toPlayoutItem,
} from './EtvNextPlayoutItemMapper.ts';
import type { PlayoutItem } from './generated/playout.ts';

/**
 * How far ahead a window is materialized.
 *
 * This is how far the worker is committed to a schedule Tunarr may since have
 * changed, and how much work each rebuild costs, so it is kept short. The
 * session rebuilds the window well before it drains, so depth buys nothing.
 */
export const DefaultWindowMs = 2 * 60 * 60 * 1000;

/**
 * A ceiling on items per window, so a channel of very short programs cannot
 * make one materialization run unbounded.
 */
export const MaxItemsPerWindow = 2000;

export type MaterializedWindow = {
  startMs: number;
  finishMs: number;
  items: PlayoutItem[];

  /** Settings that did not survive the crossing, for the session to log once. */
  ignored: string[];
};

/**
 * How long an error screen stands in for a schedule the resolver could not
 * read.
 *
 * Short, because the worker asks again as soon as it runs out, and that is the
 * only retry the dynamic path gets.
 */
export const ResolverErrorItemMs = 30_000;

/**
 * The shortest item the dynamic resolver hands back.
 *
 * The worker re-resolves the instant an item ends, so a sub-second item turns
 * the callback into a hot loop over the database and the media source. Filler
 * floors at 1 ms in `StreamProgramCalculator`, so this is reachable.
 */
export const MinResolvedItemMs = 1_000;

/**
 * How many too-short items one callback walks past before it gives up.
 *
 * Each skip costs another schedule walk inside a request the worker is waiting
 * on, so the budget stays small. The ordinary case needs one, because a viewer
 * who joins on the tail of a program lands on its last few hundred
 * milliseconds, and a handful covers a short run of filler behind it.
 */
export const MaxResolveSkips = 5;

/**
 * How much playout time one callback folds into a transition.
 *
 * A skipped item is returned at the position the worker asked about, so the
 * schedule after it runs this much early. Two seconds stays under what a
 * viewer reads as a seam, and it stops a run of items just under the floor
 * from walking the channel forward.
 */
export const MaxSkipAheadMs = 2_000;

/** What one walk of the schedule produced for a dynamic callback. */
type DynamicResolution =
  | { lineupItem: StreamLineupItem }
  | { failure: 'unreadable' | 'all-too-short' };

/** How long a channel's callback budget runs before it resets. */
export const CallbackWindowMs = 10_000;

/**
 * Callbacks one channel may make per window.
 *
 * A healthy channel calls once per program, so this sits orders of magnitude
 * above normal and only catches a schedule spinning the worker.
 */
export const MaxCallbacksPerWindow = 60;

/**
 * The item served when even the error screen could not be built.
 *
 * Nothing about the request is trusted here, so it carries its own clock and
 * its own resolution. Upstream answers a 5xx with silent black video, which
 * makes a failure on this route invisible, so the route has to answer every
 * input with something playable.
 */
function lastResortErrorItem(id: string): PlayoutItemMapping {
  const startMs = Date.now();

  const item: PlayoutItem = {
    id,
    start: rfc3339(startMs),
    finish: rfc3339(startMs + ResolverErrorItemMs),
    tracks: {
      video: {
        source: { source_type: 'lavfi', params: 'color=c=black:s=1280x720' },
      },
      audio: { source: { source_type: 'lavfi', params: 'anullsrc' } },
    },
  };

  return {
    item,
    ignored: ['an error screen could not be built, so the item plays as black'],
  };
}

/** The channel settings that decide what a flex or error slot looks like. */
type ScreenOptions = Pick<
  Parameters<typeof toPlayoutItem>[0],
  | 'resolution'
  | 'offlinePicture'
  | 'offlineSoundtrack'
  | 'offlineMode'
  | 'errorScreen'
  | 'errorScreenAudio'
  | 'errorPicture'
>;

/**
 * Walks a channel's schedule forward and turns it into a playout window.
 *
 * `StreamProgramCalculator` answers one question at a time — what plays at this
 * instant — so the window is built by asking repeatedly and advancing the
 * cursor by each answer's `streamDuration`. That is the same walk the HLS
 * sessions do against their own `transcodedUntil`, except it runs ahead of
 * playback instead of alongside it.
 *
 * The same per-item logic answers the dynamic resolver's callbacks through
 * `resolveDynamicItem`, one item at a time instead of a window at a time.
 *
 * The pre-materialized path is not scaffolding. A one-item window is exactly
 * what a diagnostic transcode needs, and it stays the fallback if the dynamic
 * resolver proves troublesome.
 */
@injectable()
export class EtvNextPlayoutWriter {
  @InjectLogger() declare private readonly logger: Logger;

  /** Per-channel callback budget for the dynamic resolver. */
  private readonly callbackWindows = new Map<
    string,
    { startMs: number; count: number }
  >();

  constructor(
    @inject(StreamProgramCalculator)
    private programCalculator: StreamProgramCalculator,
    @inject(ProgramStreamDetailsFetcher)
    private streamDetailsFetcher: ProgramStreamDetailsFetcher,
    @inject(MediaSourceDB) private mediaSourceDB: MediaSourceDB,
    @inject(OnDemandChannelService)
    private onDemandService: OnDemandChannelService,
  ) {}

  /**
   * Materializes `[startMs, startMs + windowMs)` for a channel.
   *
   * Stops early at the first item the schedule cannot answer for rather than
   * emitting a gap, because a covered-but-empty moment degrades to black
   * upstream with nothing logged.
   *
   * `idSeed` starts the item numbering. Item ids must be unique within a
   * playout and stable across rewrites, so a caller extending an existing
   * window passes the number of items it has already emitted.
   */
  /**
   * A one-item window holding a single program, for a diagnostic transcode.
   *
   * The schedule is not consulted. A troubleshoot run names the program and the
   * offset to seek to, so the walk `materializeWindow` does would answer a
   * different question — what is on air now — and play the wrong thing.
   *
   * @throws StreamTerminationRequestedError when the channel's error screen is
   *   `kill` and the item degrades, which the caller reports rather than acts on.
   */
  async materializeProgram({
    channel,
    lineupItem,
    startMs,
  }: {
    channel: ChannelOrmWithTranscodeConfig;
    lineupItem: StreamLineupItem;
    startMs: number;
  }): Promise<MaterializedWindow> {
    const stream = await this.resolveStream(lineupItem);
    const { item, ignored } = this.mapOrDegrade({
      ...this.screenOptions(channel),
      id: `${channel.uuid}-troubleshoot`,
      startMs,
      lineupItem,
      stream,
    });

    return {
      startMs,
      finishMs: startMs + lineupItem.streamDuration,
      items: [item],
      ignored,
    };
  }

  async materializeWindow({
    channel,
    startMs,
    windowMs = DefaultWindowMs,
    idSeed = 0,
  }: {
    channel: ChannelOrmWithTranscodeConfig;
    startMs: number;
    windowMs?: number;
    idSeed?: number;
  }): Promise<MaterializedWindow> {
    const endMs = startMs + windowMs;
    const screens = this.screenOptions(channel);

    const items: PlayoutItem[] = [];
    const ignored = new Set<string>();
    let cursorMs = startMs;

    while (cursorMs < endMs && items.length < MaxItemsPerWindow) {
      // On-demand channels run on their own cursor, so wall-clock time has to
      // be translated before the schedule is asked about it.
      const scheduleNowMs = await this.onDemandService.getLiveTimestamp(
        channel.uuid,
        cursorMs,
      );

      const lineupResult = await this.programCalculator.getCurrentLineupItem({
        channelId: channel.uuid,
        startTime: scheduleNowMs,
        allowSkip: true,

        // Every call here is about a moment that has not played yet.
        recordPlayHistory: false,
      });

      if (lineupResult.isFailure()) {
        this.logger.warn(
          lineupResult.error,
          'Stopping playout window for channel %s at %d items; the schedule could not be resolved at %d',
          channel.uuid,
          items.length,
          cursorMs,
        );
        break;
      }

      const { lineupItem } = lineupResult.get();

      // A non-advancing item would spin this loop forever, and upstream picks
      // overlapping items by rfind, so a zero-length one could also mask its
      // predecessor.
      if (lineupItem.streamDuration <= 0) {
        this.logger.warn(
          'Stopping playout window for channel %s: a %s item reported a stream duration of %d',
          channel.uuid,
          lineupItem.type,
          lineupItem.streamDuration,
        );
        break;
      }

      const stream = await this.resolveStream(lineupItem);
      const id = `${channel.uuid}-${idSeed + items.length}`;
      const mapping = this.mapOrDegrade({
        ...screens,
        id,
        startMs: cursorMs,
        lineupItem,
        stream,
      });

      items.push(mapping.item);
      mapping.ignored.forEach((reason) => ignored.add(reason));
      cursorMs += lineupItem.streamDuration;
    }

    return {
      startMs,
      finishMs: cursorMs,
      items,
      ignored: [...ignored],
    };
  }

  /**
   * Gathers the channel settings the mapper draws flex and error slots from.
   *
   * The generic error picture is only resolved for the screen that reads it,
   * because building the URL needs the server's own listen port.
   */
  private screenOptions(channel: ChannelOrmWithTranscodeConfig): ScreenOptions {
    const { resolution, errorScreen, errorScreenAudio } =
      channel.transcodeConfig;

    return {
      resolution,
      errorScreen,
      errorScreenAudio,
      errorPicture:
        errorScreen === 'pic'
          ? makeLocalUrl('/images/generic-error-screen.png')
          : undefined,
      offlinePicture: channel.offline?.picture,
      offlineSoundtrack: channel.offline?.soundtrack,
      offlineMode: channel.offline?.mode,
    };
  }

  /**
   * Answers one dynamic-source callback with whatever plays at an instant.
   *
   * The worker asks about the position it is transcoding, which runs ahead of
   * wall clock, then forces the returned item's `start` to that position and
   * clamps its `finish` to the placeholder's. So this only has to say what
   * plays and where in the file that position falls.
   *
   * An item too short to be worth a transcode is walked past rather than
   * served, so the answer can be the item after the one at that position.
   *
   * It reports no failure to the worker. Upstream answers an error with black
   * video and no log, so an unanswerable moment degrades to an error screen
   * short enough that the worker asks again within seconds.
   *
   * @throws StreamTerminationRequestedError when the channel's error screen is
   *   `kill`. That asks for the stream to end, which is the caller's to do.
   */
  async resolveDynamicItem({
    channel,
    startMs,
    untilMs,
  }: {
    channel: ChannelOrmWithTranscodeConfig;
    startMs: number;
    untilMs?: number;
  }): Promise<PlayoutItemMapping> {
    const screens = this.screenOptions(channel);

    // Unique per position, so the worker reads each answer as a new item
    // rather than as the previous one continuing.
    const id = `${channel.uuid}-${startMs}`;

    if (this.isCallbackFlooding(channel.uuid)) {
      this.logger.error(
        'Channel %s has asked for more than %d playout items in %d ms. Backing it off with an error screen; its schedule is producing items faster than they can play.',
        channel.uuid,
        MaxCallbacksPerWindow,
        CallbackWindowMs,
      );

      return this.safeResolverErrorItem({
        id,
        startMs,
        untilMs,
        screens,
        message: 'The channel schedule is producing items too quickly',
      });
    }

    try {
      // On-demand channels run on their own cursor, so the transcode position
      // has to be translated before the schedule is asked about it.
      const scheduleNowMs = await this.onDemandService.getLiveTimestamp(
        channel.uuid,
        startMs,
      );

      const resolution = await this.resolvePlayableItem(
        channel.uuid,
        scheduleNowMs,
        startMs,
      );

      if ('failure' in resolution) {
        return this.safeResolverErrorItem({
          id,
          startMs,
          untilMs,
          screens,
          message:
            resolution.failure === 'unreadable'
              ? 'The channel schedule could not be read'
              : 'The channel schedule produced only items too short to play',
        });
      }

      const { lineupItem } = resolution;
      const stream = await this.resolveStream(lineupItem);

      return this.mapOrDegrade({
        ...screens,
        id,
        startMs,
        lineupItem,
        stream,
      });
    } catch (e) {
      if (e instanceof StreamTerminationRequestedError) {
        throw e;
      }

      this.logger.error(
        e,
        'Resolving a playout item for channel %s at %d failed',
        channel.uuid,
        startMs,
      );

      return this.safeResolverErrorItem({
        id,
        startMs,
        untilMs,
        screens,
        message: 'The channel schedule could not be read',
      });
    }
  }

  /**
   * Walks the schedule forward to the first item long enough to be worth a
   * transcode.
   *
   * A viewer who joins on the tail of a program resolves to a remainder of a
   * few hundred milliseconds, and serving it would have the worker back within
   * the same second. Standing up a transcode for that remainder costs more
   * than the transition it covers, so the walk passes over it and the next
   * item takes its place.
   *
   * Two budgets bound the walk, because they catch different schedules. The
   * skip count stops a run of millisecond filler, where the time budget would
   * barely move, and the time budget stops a run of items just under the floor,
   * where the count would let the channel drift seconds ahead of itself.
   *
   * @param scheduleNowMs The channel's own clock, already translated through
   *   the on-demand cursor.
   * @param startMs The transcode position the worker asked about, for logging.
   */
  private async resolvePlayableItem(
    channelUuid: string,
    scheduleNowMs: number,
    startMs: number,
  ): Promise<DynamicResolution> {
    let cursorMs = scheduleNowMs;
    let skippedMs = 0;
    let skips = 0;

    for (;;) {
      // Play history is stamped at the requested time and this moment is about
      // to air, so the default recording behaviour is the correct one here.
      const lineupResult = await this.programCalculator.getCurrentLineupItem({
        channelId: channelUuid,
        startTime: cursorMs,
        allowSkip: true,
      });

      if (lineupResult.isFailure()) {
        this.logger.error(
          lineupResult.error,
          'Channel %s has nothing to play at %d. The viewer gets an error screen until the schedule answers again.',
          channelUuid,
          cursorMs,
        );

        return { failure: 'unreadable' };
      }

      const { lineupItem } = lineupResult.get();

      if (lineupItem.streamDuration >= MinResolvedItemMs) {
        if (skips > 0) {
          this.logger.debug(
            'Channel %s folded %d item(s) worth %d ms into the transition at %d rather than transcoding them.',
            channelUuid,
            skips,
            skippedMs,
            startMs,
          );
        }

        return { lineupItem };
      }

      // A zero-length item resolves to itself, so the cursor moves regardless.
      const advanceMs = Math.max(lineupItem.streamDuration, 1);

      if (skips >= MaxResolveSkips || skippedMs + advanceMs > MaxSkipAheadMs) {
        this.logger.error(
          'Channel %s answered %d with %d consecutive items under the %d ms floor, worth %d ms in all, and the walk ran out of budget on a %s item of %d ms. Its schedule cannot fill a second of airtime, so the viewer gets an error screen.',
          channelUuid,
          startMs,
          skips + 1,
          MinResolvedItemMs,
          skippedMs + advanceMs,
          lineupItem.type,
          lineupItem.streamDuration,
        );

        return { failure: 'all-too-short' };
      }

      skips += 1;
      skippedMs += advanceMs;
      cursorMs += advanceMs;
    }
  }

  /**
   * Counts a channel's callbacks and says whether it has blown its budget.
   *
   * One entry per channel, holding a window start and a count, so the map is
   * bounded by the number of channels ever streamed.
   */
  private isCallbackFlooding(channelUuid: string): boolean {
    const nowMs = Date.now();
    const window = this.callbackWindows.get(channelUuid);

    if (window === undefined || nowMs - window.startMs >= CallbackWindowMs) {
      this.callbackWindows.set(channelUuid, { startMs: nowMs, count: 1 });
      return false;
    }

    window.count += 1;
    return window.count > MaxCallbacksPerWindow;
  }

  /**
   * `resolverErrorItem` behind a net.
   *
   * It is the last thing between a bad input and a 5xx, and upstream turns a
   * 5xx into silent black video, so its own failure has to resolve to
   * something playable rather than escape the route.
   *
   * @throws StreamTerminationRequestedError when the channel's error screen is
   *   `kill`, which the caller owns.
   */
  private safeResolverErrorItem(args: {
    id: string;
    startMs: number;
    untilMs?: number;
    screens: ScreenOptions;
    message: string;
  }): PlayoutItemMapping {
    try {
      return this.resolverErrorItem(args);
    } catch (e) {
      if (e instanceof StreamTerminationRequestedError) {
        throw e;
      }

      this.logger.error(
        e,
        'Could not build an error screen for playout item %s. Falling back to black.',
        args.id,
      );

      return lastResortErrorItem(args.id);
    }
  }

  /**
   * A short error screen for a moment the schedule could not answer.
   *
   * The detail stays in the log rather than in the item, because the message
   * can be burned into the frame a viewer sees.
   */
  private resolverErrorItem({
    id,
    startMs,
    untilMs,
    screens,
    message,
  }: {
    id: string;
    startMs: number;
    untilMs?: number;
    screens: ScreenOptions;
    message: string;
  }): PlayoutItemMapping {
    const remainingMs =
      untilMs !== undefined ? untilMs - startMs : ResolverErrorItemMs;
    const durationMs = Math.max(
      1_000,
      Math.min(ResolverErrorItemMs, remainingMs),
    );

    return toPlayoutItem({
      ...screens,
      id,
      startMs,
      lineupItem: {
        type: 'error',
        error: message,
        programBeginMs: startMs,
        duration: durationMs,
        streamDuration: durationMs,
        startOffset: 0,
      },
    });
  }

  /**
   * Maps one slot, falling back to an error screen when the item cannot be
   * expressed.
   *
   * One unplayable program must not cost the channel its whole window. Tunarr
   * already degrades a failing item to an error screen and keeps the channel
   * running, so the slot keeps its place on the timeline and the schedule after
   * it still lines up with wall clock.
   *
   * @throws StreamTerminationRequestedError when the channel's error screen is
   *   `kill`, which asks for the stream to end rather than for a screen.
   */
  private mapOrDegrade(
    request: Parameters<typeof toPlayoutItem>[0],
  ): ReturnType<typeof toPlayoutItem> {
    try {
      return toPlayoutItem(request);
    } catch (e) {
      if (e instanceof StreamTerminationRequestedError) {
        throw e;
      }

      this.logger.warn(
        e,
        'Falling back to an error screen for playout item %s',
        request.id,
      );

      const mapping = toPlayoutItem({
        ...request,
        lineupItem: {
          type: 'error',
          error: e instanceof Error ? e.message : String(e),
          programBeginMs: request.lineupItem.programBeginMs,
          duration: request.lineupItem.duration,
          streamDuration: request.lineupItem.streamDuration,
          startOffset: 0,
        },
        stream: undefined,
      });

      return {
        item: mapping.item,
        ignored: [
          ...mapping.ignored,
          'at least one item could not be resolved and plays as an error screen',
        ],
      };
    }
  }

  /**
   * Resolves a content item's source.
   *
   * Offline and error items carry no media, and a failed resolution is left
   * undefined so the mapper surfaces it rather than this method inventing a
   * substitute.
   */
  private async resolveStream(
    lineupItem: StreamLineupItem,
  ): Promise<{ source: StreamSource; details?: StreamDetails } | undefined> {
    if (!isContentBackedLineupItem(lineupItem)) {
      return undefined;
    }

    const contentItem: ContentBackedStreamLineupItem = lineupItem;
    const server = await this.mediaSourceDB.getById(
      contentItem.program.mediaSourceId,
    );

    if (!server) {
      this.logger.warn(
        'Program %s names media source %s, which does not exist',
        contentItem.program.uuid,
        contentItem.program.mediaSourceId,
      );
      return undefined;
    }

    const result = await this.streamDetailsFetcher.getStream({
      server,
      lineupItem: contentItem.program,
    });

    if (result.isFailure()) {
      this.logger.warn(
        result.error,
        'Could not resolve a stream for program %s',
        contentItem.program.uuid,
      );
      return undefined;
    }

    const { streamSource, streamDetails } = result.get();
    return { source: streamSource, details: streamDetails };
  }
}
