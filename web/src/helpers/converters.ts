import { seq } from '@tunarr/shared/util';
import type { FillerProgram } from '@tunarr/types';
import type { InfiniteScheduleGenerationResponse } from '@tunarr/types/api';
import { match, P } from 'ts-pattern';
import type {
  UIChannelProgram,
  UIFlexProgram,
  UIRedirectProgram,
} from '../types/index.ts';
import type { Nilable } from '../types/util.ts';
import { isNonEmptyString } from './util.ts';

export function scheduleGenerationResponseToLineupList(
  response: InfiniteScheduleGenerationResponse,
): UIChannelProgram[] {
  return seq.collect(response?.items, (scheduleItem, idx) => {
    return (
      match(scheduleItem)
        .returnType<Nilable<UIChannelProgram>>()
        .with(
          { itemType: 'content', programUuid: P.when(isNonEmptyString) },
          (c) => {
            const program = response?.contentPrograms[c.programUuid];
            if (!program) return;
            return {
              ...program,
              uiIndex: idx,
              originalIndex: idx,
              startTime: c.startTimeMs,
            } satisfies UIChannelProgram;
          },
        )
        .with(
          { itemType: 'filler', programUuid: P.when(isNonEmptyString) },
          (f) => {
            const program = response?.contentPrograms[f.programUuid];
            if (!program) return null;
            return {
              type: 'filler' as const,
              id: f.programUuid,
              fillerListId: f.fillerListId,
              program,
              duration: f.durationMs,
              persisted: true,
              uiIndex: idx,
              originalIndex: idx,
              startTime: f.startTimeMs,
            } satisfies UIChannelProgram<FillerProgram>;
          },
        )
        .with(
          { itemType: 'flex' },
          (f) =>
            ({
              duration: f.durationMs,
              originalIndex: idx,
              uiIndex: idx,
              persisted: false,
              type: 'flex',
              startTime: f.startTimeMs,
            }) satisfies UIFlexProgram,
        )
        // TODO: materialize redirect
        .with(
          { itemType: 'redirect' },
          (rdir) =>
            ({
              ...rdir,
              type: 'redirect',
              channelName: '',
              channelNumber: -1,
              channel: rdir.redirectChannelId,
              duration: rdir.durationMs,
              uiIndex: idx,
              originalIndex: idx,
              persisted: false,
              startTime: rdir.startTimeMs,
            }) satisfies UIRedirectProgram,
        )
        // TODO: materialize other item types
        .otherwise(() => null)
    );
  });
}
