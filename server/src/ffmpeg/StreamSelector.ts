import { inject, injectable } from 'inversify';
import type { NonEmptyArray } from 'ts-essentials';
import type { ContentBackedStreamLineupItem } from '../db/derived_types/StreamLineup.ts';
import {
  isCommercialLineupItem,
  isProgramLineupItem,
} from '../db/derived_types/StreamLineup.ts';
import type { ChannelOrm } from '../db/schema/Channel.ts';
import { CelEvaluationService } from '../services/CelEvaluationService.ts';
import { StreamSelectionProfileResolver } from '../services/StreamSelectionProfileResolver.ts';
import type {
  AudioStreamDetails,
  SubtitleStreamDetails,
} from '../stream/types.ts';
import {
  buildCelContext,
  evaluateStreamSelectionProfile,
  evaluateSubtitleSelection,
} from './StreamSelectionEvaluator.ts';
import type { StreamSelectionHints } from './StreamSelectionEvaluator.ts';

type StreamSelectRequest = {
  channel: ChannelOrm;
  lineupItem: ContentBackedStreamLineupItem;
  audioStreams: NonEmptyArray<AudioStreamDetails>;
  subtitleStreams: SubtitleStreamDetails[];
  hints?: StreamSelectionHints;
};

type SubtitleSelectRequest = Omit<StreamSelectRequest, 'audioStreams'> & {
  audioStreams?: AudioStreamDetails[];
};

@injectable()
export class StreamSelector {
  constructor(
    @inject(StreamSelectionProfileResolver)
    private streamSelectionResolver: StreamSelectionProfileResolver,
    @inject(CelEvaluationService) private celService: CelEvaluationService,
  ) {}

  async selectAudioAndSubtitleStreams({
    channel,
    lineupItem,
    audioStreams,
    subtitleStreams,
    hints,
  }: StreamSelectRequest) {
    const profile = await this.streamSelectionResolver.resolve(
      this.buildSelectionContext(channel, lineupItem),
    );

    return await evaluateStreamSelectionProfile(
      profile,
      audioStreams,
      subtitleStreams,
      this.celService,
      this.buildCelContextFor(
        channel,
        lineupItem,
        audioStreams,
        subtitleStreams,
      ),
      lineupItem,
      hints,
    );
  }

  /**
   * Select a subtitle stream without selecting audio. Passthrough output keeps
   * the source audio untouched, so it has no audio stream to pick and content
   * with no audio at all must still get subtitles.
   */
  async selectSubtitleStream({
    channel,
    lineupItem,
    audioStreams = [],
    subtitleStreams,
    hints,
  }: SubtitleSelectRequest) {
    const profile = await this.streamSelectionResolver.resolve(
      this.buildSelectionContext(channel, lineupItem),
    );

    return await evaluateSubtitleSelection(
      profile,
      subtitleStreams,
      this.celService,
      this.buildCelContextFor(
        channel,
        lineupItem,
        audioStreams,
        subtitleStreams,
      ),
      lineupItem,
      hints,
    );
  }

  private buildSelectionContext(
    channel: ChannelOrm,
    lineupItem: ContentBackedStreamLineupItem,
  ) {
    return {
      channelId: channel.uuid,
      programId: lineupItem.program.uuid,
      fillerListId: isCommercialLineupItem(lineupItem)
        ? lineupItem.fillerListId
        : undefined,
      customShowId: isProgramLineupItem(lineupItem)
        ? lineupItem.customShowId
        : undefined,
    };
  }

  private buildCelContextFor(
    channel: ChannelOrm,
    lineupItem: ContentBackedStreamLineupItem,
    audioStreams: readonly AudioStreamDetails[],
    subtitleStreams: SubtitleStreamDetails[],
  ) {
    return buildCelContext(
      audioStreams,
      subtitleStreams,
      { name: channel.name, number: channel.number },
      { title: lineupItem.program.title, type: lineupItem.program.type },
    );
  }
}
