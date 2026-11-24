import type { CondensedChannelProgram } from '@tunarr/types';
import type { LineupItem } from '../derived_types/Lineup.ts';

export function condensedProgramToLineupItem(
  p: CondensedChannelProgram,
): LineupItem {
  switch (p.type) {
    case 'content':
      return {
        type: 'content',
        id: p.id,
        durationMs: p.duration,
        startOffsetMs: p.startOffsetMs,
      };
    case 'custom':
      return {
        type: 'content',
        durationMs: p.duration,
        id: p.id,
        customShowId: p.customShowId,
        startOffsetMs: p.startOffsetMs,
      };
    case 'filler':
      return {
        type: 'content',
        durationMs: p.duration,
        id: p.id,
        fillerListId: p.fillerListId,
        fillerType: p.fillerType,
      };
    case 'redirect':
      return {
        type: 'redirect',
        channel: p.channel,
        durationMs: p.duration,
      };
    case 'flex':
      return {
        type: 'offline',
        durationMs: p.duration,
        fillerConfig: p.fillerConfig,
      };
  }
}
