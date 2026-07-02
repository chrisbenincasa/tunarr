import { inject, injectable } from 'inversify';
import { NonEmptyArray } from 'ts-essentials';
import {
  ContentBackedStreamLineupItem,
  isCommercialLineupItem,
  isProgramLineupItem,
} from '../db/derived_types/StreamLineup.ts';
import { ChannelOrm } from '../db/schema/Channel.ts';
import { CelEvaluationService } from '../services/CelEvaluationService.ts';
import { StreamSelectionProfileResolver } from '../services/StreamSelectionProfileResolver.ts';
import { AudioStreamDetails, SubtitleStreamDetails } from '../stream/types.ts';
import {
  buildCelContext,
  evaluateStreamSelectionProfile,
} from './StreamSelectionEvaluator.ts';
import type { StreamSelectionHints } from './StreamSelectionEvaluator.ts';

type StreamSelectRequest = {
  channel: ChannelOrm;
  lineupItem: ContentBackedStreamLineupItem;
  audioStreams: NonEmptyArray<AudioStreamDetails>;
  subtitleStreams: Array<SubtitleStreamDetails>;
  hints?: StreamSelectionHints;
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
    const selectionCtx = {
      channelId: channel.uuid,
      programId: lineupItem.program.uuid,
      fillerListId: isCommercialLineupItem(lineupItem)
        ? lineupItem.fillerListId
        : undefined,
      customShowId: isProgramLineupItem(lineupItem)
        ? lineupItem.customShowId
        : undefined,
    };

    const profile = await this.streamSelectionResolver.resolve(selectionCtx);
    const celContext = buildCelContext(
      audioStreams,
      subtitleStreams,
      { name: channel.name, number: channel.number },
      { title: lineupItem.program.title, type: lineupItem.program.type },
    );

    return await evaluateStreamSelectionProfile(
      profile,
      audioStreams,
      subtitleStreams,
      this.celService,
      celContext,
      lineupItem,
      hints,
    );
  }
}
