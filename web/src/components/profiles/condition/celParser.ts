// Best-effort parser: converts known CEL patterns back to a ConditionGroup.
// Returns null when the expression uses constructs the basic builder can't represent.

import type {
  ComparisonOperator,
  ConditionClause,
  ConditionEntry,
  ConditionGroup,
  ListOperator,
  NumericOperator,
} from './types.ts';

// Tokenizer for a small subset of CEL we care about.
// Rather than a full parser, we match known leaf patterns first,
// then handle && / || / parentheses structurally.

type Token =
  | { kind: 'leaf'; clause: ConditionClause }
  | { kind: 'and' }
  | { kind: 'or' }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

const LEAF_PATTERNS: Array<{
  regex: RegExp;
  extract: (m: RegExpMatchArray) => ConditionClause | null;
}> = [
  // "true"
  {
    regex: /^true$/,
    extract: () => ({ type: 'always' }),
  },
  // program.type == "movie" / program.type != "movie"
  {
    regex: /^program\.type\s*(==|!=)\s*"([^"]+)"$/,
    extract: (m) => ({
      type: 'program_type',
      operator: (m[1] === '==' ? 'eq' : 'neq') as ComparisonOperator,
      value: m[2],
    }),
  },
  // "eng" in audio.languages
  {
    regex: /^"([^"]+)"\s+in\s+audio\.languages$/,
    extract: (m) => ({
      type: 'audio_language',
      operator: 'in' as ListOperator,
      value: m[1],
    }),
  },
  // !("eng" in audio.languages)
  {
    regex: /^!\("([^"]+)"\s+in\s+audio\.languages\)$/,
    extract: (m) => ({
      type: 'audio_language',
      operator: 'not_in' as ListOperator,
      value: m[1],
    }),
  },
  // "eng" in subtitle.languages
  {
    regex: /^"([^"]+)"\s+in\s+subtitle\.languages$/,
    extract: (m) => ({
      type: 'subtitle_language',
      operator: 'in' as ListOperator,
      value: m[1],
    }),
  },
  // !("eng" in subtitle.languages)
  {
    regex: /^!\("([^"]+)"\s+in\s+subtitle\.languages\)$/,
    extract: (m) => ({
      type: 'subtitle_language',
      operator: 'not_in' as ListOperator,
      value: m[1],
    }),
  },
  // audio.streams.exists(s, s.channels >= 6)
  {
    regex:
      /^audio\.streams\.exists\(s,\s*s\.channels\s*(==|>=|<=|>|<)\s*(\d+)\)$/,
    extract: (m) => {
      const opMap: Record<string, NumericOperator> = {
        '==': 'eq',
        '>=': 'gte',
        '<=': 'lte',
        '>': 'gt',
        '<': 'lt',
      };
      const op = opMap[m[1]];
      if (op === undefined) return null;
      return {
        type: 'audio_channels',
        operator: op,
        value: parseInt(m[2], 10),
      };
    },
  },
];

function tryParseLeaf(expr: string): ConditionClause | null {
  const trimmed = expr.trim();
  for (const pattern of LEAF_PATTERNS) {
    const m = trimmed.match(pattern.regex);
    if (m) {
      return pattern.extract(m);
    }
  }
  return null;
}

// Tokenize a CEL string into leaves, operators, and parens.
// This is a simplified approach that works for expressions we generate.
function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let pos = 0;
  const s = input.trim();

  while (pos < s.length) {
    // Skip whitespace
    while (pos < s.length && /\s/.test(s[pos])) pos++;
    if (pos >= s.length) break;

    // Parentheses
    if (s[pos] === '(') {
      tokens.push({ kind: 'lparen' });
      pos++;
      continue;
    }
    if (s[pos] === ')') {
      tokens.push({ kind: 'rparen' });
      pos++;
      continue;
    }

    // && or ||
    if (s.startsWith('&&', pos)) {
      tokens.push({ kind: 'and' });
      pos += 2;
      continue;
    }
    if (s.startsWith('||', pos)) {
      tokens.push({ kind: 'or' });
      pos += 2;
      continue;
    }

    // Try to match a leaf expression starting at pos.
    // Leaves can contain parens (like the negated and exists patterns),
    // so we need to be careful.
    const rest = s.slice(pos);
    const leafEnd = findLeafEnd(rest);
    if (leafEnd <= 0) return null; // can't parse

    const leafStr = rest.slice(0, leafEnd).trim();
    const clause = tryParseLeaf(leafStr);
    if (!clause) return null; // unknown expression
    tokens.push({ kind: 'leaf', clause });
    pos += leafEnd;
  }

  return tokens.length > 0 ? tokens : null;
}

// Find where a leaf expression ends by tracking balanced parens and
// stopping at an unbalanced ) or a top-level && / ||.
function findLeafEnd(s: string): number {
  let depth = 0;
  let i = 0;

  // Handle leading !( for negation patterns
  if (s[i] === '!') i++;

  while (i < s.length) {
    if (s[i] === '(') {
      depth++;
      i++;
    } else if (s[i] === ')') {
      if (depth === 0) return i; // unbalanced — end of leaf
      depth--;
      i++;
    } else if (
      depth === 0 &&
      (s.startsWith('&&', i) || s.startsWith('||', i))
    ) {
      return i;
    } else if (s[i] === '"') {
      // Skip string literal
      i++;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\') i++; // skip escape
        i++;
      }
      if (i < s.length) i++; // closing quote
    } else {
      i++;
    }
  }

  return depth === 0 ? i : -1;
}

// Recursive descent parser for tokens.
// Grammar:
//   expr     = group
//   group    = primary (('&&' | '||') primary)*
//   primary  = leaf | '(' expr ')'
function parseTokens(
  tokens: Token[],
  start: number,
): { entry: ConditionEntry; next: number } | null {
  return parseGroup(tokens, start);
}

function parseGroup(
  tokens: Token[],
  start: number,
): { entry: ConditionEntry; next: number } | null {
  const first = parsePrimary(tokens, start);
  if (!first) return null;

  const entries: ConditionEntry[] = [first.entry];
  let operator: 'and' | 'or' | null = null;
  let pos = first.next;

  while (pos < tokens.length) {
    const tok = tokens[pos];
    if (tok.kind !== 'and' && tok.kind !== 'or') break;

    const thisOp = tok.kind === 'and' ? 'and' : 'or';
    // All operators in a flat group must be the same
    if (operator !== null && operator !== thisOp) {
      // Mixed operators without parens — can't represent in basic mode
      return null;
    }
    operator = thisOp as 'and' | 'or';
    pos++;

    const next = parsePrimary(tokens, pos);
    if (!next) return null;
    entries.push(next.entry);
    pos = next.next;
  }

  if (entries.length === 1) {
    return { entry: entries[0], next: pos };
  }

  const group: ConditionGroup = {
    type: 'group',
    operator: operator ?? 'and',
    conditions: entries,
  };
  return { entry: group, next: pos };
}

function parsePrimary(
  tokens: Token[],
  start: number,
): { entry: ConditionEntry; next: number } | null {
  if (start >= tokens.length) return null;

  const tok = tokens[start];
  if (tok.kind === 'leaf') {
    return { entry: tok.clause, next: start + 1 };
  }

  if (tok.kind === 'lparen') {
    const inner = parseGroup(tokens, start + 1);
    if (!inner) return null;
    if (
      inner.next >= tokens.length ||
      tokens[inner.next].kind !== 'rparen'
    ) {
      return null;
    }
    return { entry: inner.entry, next: inner.next + 1 };
  }

  return null;
}

/**
 * Attempt to parse a CEL expression string into a basic ConditionGroup.
 * Returns null if the expression uses constructs the basic builder can't represent.
 */
export function celToBasicCondition(cel: string): ConditionGroup | null {
  const trimmed = cel.trim();
  if (!trimmed) return null;

  // Fast path: single leaf
  const singleLeaf = tryParseLeaf(trimmed);
  if (singleLeaf) {
    return {
      type: 'group',
      operator: 'and',
      conditions: [singleLeaf],
    };
  }

  const tokens = tokenize(trimmed);
  if (!tokens) return null;

  const result = parseTokens(tokens, 0);
  if (!result || result.next !== tokens.length) return null;

  // Ensure top level is a group
  const entry = result.entry;
  if (entry.type === 'group') {
    return entry;
  }

  return {
    type: 'group',
    operator: 'and',
    conditions: [entry],
  };
}
