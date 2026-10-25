// Structured condition types for the basic condition builder.
// These are a UI-only concern — the API always stores a CEL string.

import { msg } from '@lingui/core/macro';
import type { MessageDescriptor } from '@lingui/core';

export type ConditionOperator = 'and' | 'or';

export type ClauseType =
  | 'always'
  | 'program_type'
  | 'audio_language'
  | 'subtitle_language'
  | 'audio_channels';

export type ComparisonOperator = 'eq' | 'neq';
export type ListOperator = 'in' | 'not_in';
export type NumericOperator = 'eq' | 'gte' | 'lte' | 'gt' | 'lt';

export type ConditionClause =
  | { type: 'always' }
  | { type: 'program_type'; operator: ComparisonOperator; value: string }
  | { type: 'audio_language'; operator: ListOperator; value: string }
  | { type: 'subtitle_language'; operator: ListOperator; value: string }
  | {
      type: 'audio_channels';
      operator: NumericOperator;
      value: number;
    };

export interface ConditionGroup {
  type: 'group';
  operator: ConditionOperator;
  conditions: ConditionEntry[];
}

export type ConditionEntry = ConditionClause | ConditionGroup;

export type ConditionMode = 'basic' | 'cel';

export const PROGRAM_TYPES: ReadonlyArray<{
  value: string;
  label: MessageDescriptor;
}> = [
  { value: 'movie', label: msg`Movie` },
  { value: 'episode', label: msg`Episode` },
  { value: 'track', label: msg`Track` },
  { value: 'music_video', label: msg`Music Video` },
  { value: 'other_video', label: msg`Other Video` },
];

export const CLAUSE_TYPE_LABELS: Record<ClauseType, MessageDescriptor> = {
  always: msg`Always match`,
  program_type: msg`Program type`,
  audio_language: msg`Audio language`,
  subtitle_language: msg`Subtitle language`,
  audio_channels: msg`Audio channel count`,
};

export const COMPARISON_OPERATOR_LABELS: Record<ComparisonOperator, MessageDescriptor> = {
  eq: msg`is`,
  neq: msg`is not`,
};

export const LIST_OPERATOR_LABELS: Record<ListOperator, MessageDescriptor> = {
  in: msg`includes`,
  not_in: msg`does not include`,
};

export const NUMERIC_OPERATOR_LABELS: Record<NumericOperator, string> = {
  eq: '=',
  gte: '≥',
  lte: '≤',
  gt: '>',
  lt: '<',
};

export function isConditionGroup(entry: ConditionEntry): entry is ConditionGroup {
  return entry.type === 'group';
}

export function createDefaultClause(): ConditionClause {
  return { type: 'program_type', operator: 'eq', value: 'movie' };
}

export function createDefaultGroup(): ConditionGroup {
  return {
    type: 'group',
    operator: 'and',
    conditions: [createDefaultClause()],
  };
}
