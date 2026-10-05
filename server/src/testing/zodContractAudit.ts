import type z from 'zod/v4';

export type ZodContractFindingKind =
  | 'catch'
  | 'default-under-optional'
  | 'optional-inside-pipe'
  | 'coerce';

export type ZodContractFinding = {
  kind: ZodContractFindingKind;
  /** Dotted path to the offending node, e.g. `watermark.opacity`. */
  path: string;
};

type ZodDef = {
  type: string;
  coerce?: boolean;
  shape?: Record<string, unknown>;
  innerType?: unknown;
  element?: unknown;
  options?: unknown[];
  items?: unknown[];
  in?: unknown;
  out?: unknown;
  keyType?: unknown;
  valueType?: unknown;
  left?: unknown;
  right?: unknown;
  getter?: () => unknown;
};

function defOf(schema: unknown): ZodDef | undefined {
  const internals = (schema as { _zod?: { def?: ZodDef } } | undefined)?._zod;
  return internals?.def;
}

/**
 * Walks a zod schema tree looking for constructs whose runtime behaviour
 * differs from what the declared contract implies.
 *
 * Each of these has produced a real bug in this codebase:
 *
 * - `catch` — swallows an invalid value and substitutes a default, so the API
 *   answers 200 having stored something other than what was sent.
 * - `default-under-optional` — what `.partial()` produces over a field that has
 *   a `.default()`. `.partial()` wraps the default rather than removing it, so
 *   an omitted key still arrives populated and the handler cannot tell
 *   "omitted" from "sent".
 * - `optional-inside-pipe` — `.optional()` on the left of a `.pipe()` only lets
 *   `undefined` through the left half; the right half still runs on it, and the
 *   pipe's non-optional output makes the whole key required.
 * - `coerce` — `z.coerce.*` accepts far more than it looks like it does, most
 *   notably turning `""` into `0` and any non-empty string into `true`.
 *
 * `coerce` is reported for review rather than as a defect; the others are
 * defects wherever the schema validates a request.
 */
export function auditZodContract(
  schema: unknown,
  options: { maxDepth?: number } = {},
): ZodContractFinding[] {
  const { maxDepth = 12 } = options;
  const findings: ZodContractFinding[] = [];
  const seen = new Set<unknown>();

  const walk = (node: unknown, path: string, depth: number) => {
    if (depth > maxDepth || node === undefined || node === null) {
      return;
    }
    const def = defOf(node);
    if (!def) {
      return;
    }
    // Recursive schemas would otherwise loop forever.
    if (seen.has(node)) {
      return;
    }
    seen.add(node);

    const label = path === '' ? '<root>' : path;

    if (def.type === 'catch') {
      findings.push({ kind: 'catch', path: label });
    }

    if (def.type === 'optional' && defOf(def.innerType)?.type === 'default') {
      findings.push({ kind: 'default-under-optional', path: label });
    }

    if (def.type === 'pipe' && containsOptional(def.in, maxDepth)) {
      findings.push({ kind: 'optional-inside-pipe', path: label });
    }

    if (def.coerce === true) {
      findings.push({ kind: 'coerce', path: label });
    }

    if (def.shape) {
      for (const [key, child] of Object.entries(def.shape)) {
        walk(child, path === '' ? key : `${path}.${key}`, depth + 1);
      }
    }

    for (const child of [
      def.innerType,
      def.element,
      def.in,
      def.out,
      def.keyType,
      def.valueType,
      def.left,
      def.right,
    ]) {
      walk(child, path, depth + 1);
    }

    for (const child of [...(def.options ?? []), ...(def.items ?? [])]) {
      walk(child, path, depth + 1);
    }

    if (typeof def.getter === 'function') {
      try {
        walk(def.getter(), path, depth + 1);
      } catch {
        // A lazy schema that cannot be resolved standalone is not auditable.
      }
    }
  };

  walk(schema as z.ZodType, '', 0);
  return findings;
}

function containsOptional(node: unknown, maxDepth: number): boolean {
  const def = defOf(node);
  if (!def || maxDepth <= 0) {
    return false;
  }
  if (def.type === 'optional') {
    return true;
  }
  return containsOptional(def.innerType, maxDepth - 1);
}

export function summarize(findings: ZodContractFinding[]) {
  return findings.reduce<Record<string, string[]>>((acc, f) => {
    (acc[f.kind] ??= []).push(f.path);
    return acc;
  }, {});
}
