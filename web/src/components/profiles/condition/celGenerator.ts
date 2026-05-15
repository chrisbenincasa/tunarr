import type {
  ConditionClause,
  ConditionEntry,
  ConditionGroup,
} from './types.ts';
import { isConditionGroup } from './types.ts';

function clauseToCel(clause: ConditionClause): string {
  switch (clause.type) {
    case 'always':
      return 'true';

    case 'program_type': {
      const op = clause.operator === 'eq' ? '==' : '!=';
      return `program.type ${op} "${clause.value}"`;
    }

    case 'audio_language': {
      const lang = JSON.stringify(clause.value);
      if (clause.operator === 'in') {
        return `${lang} in audio.languages`;
      }
      return `!(${lang} in audio.languages)`;
    }

    case 'subtitle_language': {
      const lang = JSON.stringify(clause.value);
      if (clause.operator === 'in') {
        return `${lang} in subtitle.languages`;
      }
      return `!(${lang} in subtitle.languages)`;
    }

    case 'audio_channels': {
      const opMap = {
        eq: '==',
        gte: '>=',
        lte: '<=',
        gt: '>',
        lt: '<',
      } as const;
      return `audio.streams.exists(s, s.channels ${opMap[clause.operator]} ${clause.value})`;
    }
  }
}

function entryToCel(entry: ConditionEntry, parentOperator?: string): string {
  if (!isConditionGroup(entry)) {
    return clauseToCel(entry);
  }
  return groupToCel(entry, parentOperator);
}

function groupToCel(
  group: ConditionGroup,
  parentOperator?: string,
): string {
  if (group.conditions.length === 0) {
    return 'true';
  }

  if (group.conditions.length === 1) {
    return entryToCel(group.conditions[0], group.operator);
  }

  const joiner = group.operator === 'and' ? ' && ' : ' || ';
  const parts = group.conditions.map((c) => entryToCel(c, group.operator));
  const joined = parts.join(joiner);

  // Wrap in parens if this is a nested group with a different parent operator
  if (parentOperator !== undefined && parentOperator !== group.operator) {
    return `(${joined})`;
  }

  return joined;
}

export function basicConditionToCel(condition: ConditionGroup): string {
  return groupToCel(condition);
}
