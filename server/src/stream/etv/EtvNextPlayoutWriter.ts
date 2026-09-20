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
import { toPlayoutItem } from './EtvNextPlayoutItemMapper.ts';
import type { PlayoutItem } from './generated/playout.ts';

/** How far ahead a window is materialized. */
export const DefaultWindowMs = 12 * 60 * 60 * 1000;

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
 * Walks a channel's schedule forward and turns it into a playout window.
 *
 * `StreamProgramCalculator` answers one question at a time — what plays at this
 * instant — so the window is built by asking repeatedly and advancing the
 * cursor by each answer's `streamDuration`. That is the same walk the HLS
 * sessions do against their own `transcodedUntil`, except it runs ahead of
 * playback instead of alongside it.
 *
 * This is the pre-materialized path. It is not scaffolding: a one-item window
 * is exactly what a diagnostic transcode needs, and it stays the fallback if
 * the dynamic resolver proves troublesome.
 */
@injectable()
export class EtvNextPlayoutWriter {
  @InjectLogger() declare private readonly logger: Logger;

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
   */
  async materializeWindow({
    channel,
    startMs,
    windowMs = DefaultWindowMs,
  }: {
    channel: ChannelOrmWithTranscodeConfig;
    startMs: number;
    windowMs?: number;
  }): Promise<MaterializedWindow> {
    const endMs = startMs + windowMs;
    const resolution = channel.transcodeConfig.resolution;
    const offlinePicture = channel.offline?.picture;

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
      const id = `${channel.uuid}-${items.length}`;
      const mapping = this.mapOrDegrade({
        id,
        startMs: cursorMs,
        lineupItem,
        stream,
        resolution,
        offlinePicture,
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
   * Maps one slot, falling back to an error screen when the item cannot be
   * expressed.
   *
   * One unplayable program must not cost the channel its whole window. Tunarr
   * already degrades a failing item to an error screen and keeps the channel
   * running, so the slot keeps its place on the timeline and the schedule after
   * it still lines up with wall clock.
   */
  private mapOrDegrade(
    request: Parameters<typeof toPlayoutItem>[0],
  ): ReturnType<typeof toPlayoutItem> {
    try {
      return toPlayoutItem(request);
    } catch (e) {
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
