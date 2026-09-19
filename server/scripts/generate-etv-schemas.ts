/**
 * Emits Zod schemas from the ErsatzTV `next` JSON Schemas vendored under
 * `src/stream/etv/schema/`.
 *
 * Off-the-shelf converters do not work on these documents. `json-schema-to-zod`
 * ignores `$ref` and collapses the whole item model to `z.any()`; dereferencing
 * first inlines `ProbeHint` at six call sites and produces 381 KB. This emits
 * one named export per definition instead, with `$ref` rendered as an
 * identifier.
 *
 * The documents use a closed subset of JSON Schema. Anything outside it throws
 * rather than degrading to `z.unknown()`, so upstream widening the subset fails
 * the build instead of silently weakening validation.
 *
 * Objects are emitted as `z.strictObject`. Neither `Playout` nor `ChannelConfig`
 * carries `deny_unknown_fields` at its root, so both files discard misspelled
 * keys in silence. Strict parsing before write is the only thing that catches a
 * typo like `in_point_msec`.
 *
 * Run: pnpm generate-etv-schemas
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import prettier from 'prettier';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaDir = path.join(here, '../src/stream/etv/schema');
const outDir = path.join(here, '../src/stream/etv/generated');

type JsonSchema = {
  $ref?: string;
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  format?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  discriminator?: { propertyName: string };
  minimum?: number;
  maximum?: number;
  additionalProperties?: boolean | JsonSchema;
};

type Document = JsonSchema & {
  title?: string;
  $defs?: Record<string, JsonSchema>;
  definitions?: Record<string, JsonSchema>;
};

const refName = (ref: string) => {
  const name = ref.split('/').pop();
  if (name === undefined || name.length === 0) {
    throw new Error(`Cannot read a definition name out of $ref "${ref}"`);
  }
  return name;
};

const schemaConst = (name: string) => `${name}Schema`;

const isNullBranch = (node: JsonSchema) => node.type === 'null';

/** `{ oneOf: [X, { type: "null" }] }` is nullable X, not a union with a null arm. */
const nullableBranch = (branches: JsonSchema[]) => {
  if (branches.length !== 2) {
    return undefined;
  }
  const nulls = branches.filter(isNullBranch);
  const rest = branches.filter((b) => !isNullBranch(b));
  return nulls.length === 1 && rest.length === 1 ? rest[0] : undefined;
};

function render(node: JsonSchema, ctx: string): string {
  if (node.$ref !== undefined) {
    return schemaConst(refName(node.$ref));
  }

  const branches = node.oneOf ?? node.anyOf;
  if (branches !== undefined) {
    const inner = nullableBranch(branches);
    if (inner !== undefined) {
      return `${render(inner, ctx)}.nullable()`;
    }
    const rendered = branches.map((b, i) => render(b, `${ctx}[${i}]`));
    if (node.discriminator !== undefined) {
      return `z.discriminatedUnion('${node.discriminator.propertyName}', [\n${rendered
        .map((r) => `  ${r},`)
        .join('\n')}\n])`;
    }
    return `z.union([${rendered.join(', ')}])`;
  }

  if (node.const !== undefined) {
    return `z.literal(${JSON.stringify(node.const)})`;
  }

  if (node.enum !== undefined) {
    return `z.enum([${node.enum.map((v) => JSON.stringify(v)).join(', ')}])`;
  }

  // `["integer", "null"]` is a nullable integer.
  if (Array.isArray(node.type)) {
    const nonNull = node.type.filter((t) => t !== 'null');
    if (nonNull.length !== 1 || node.type.length !== 2) {
      throw new Error(
        `${ctx}: unsupported type array ${JSON.stringify(node.type)}`,
      );
    }
    return `${render({ ...node, type: nonNull[0] }, ctx)}.nullable()`;
  }

  switch (node.type) {
    case 'object': {
      const props = node.properties ?? {};
      const required = new Set(node.required ?? []);
      const fields = Object.entries(props).map(([key, value]) => {
        const optional = required.has(key) ? '' : '.optional()';
        return `  ${JSON.stringify(key)}: ${render(value, `${ctx}.${key}`)}${optional},`;
      });
      if (fields.length === 0) {
        return `z.strictObject({})`;
      }
      return `z.strictObject({\n${fields.join('\n')}\n})`;
    }
    case 'array': {
      if (node.items === undefined) {
        throw new Error(`${ctx}: array without items`);
      }
      return `z.array(${render(node.items, `${ctx}[]`)})`;
    }
    case 'string': {
      // The schema cannot say "RFC3339 with an offset", but `next` parses these
      // with `DateTime::parse_from_rfc3339`, and a bare local time in a
      // container without TZ resolves differently than intended.
      if (node.format === 'date-time') {
        return `z.iso.datetime({ offset: true })`;
      }
      return `z.string()`;
    }
    case 'integer':
    case 'number': {
      const base = node.type === 'integer' ? `z.number().int()` : `z.number()`;
      const min = node.minimum !== undefined ? `.min(${node.minimum})` : '';
      const max = node.maximum !== undefined ? `.max(${node.maximum})` : '';
      return `${base}${min}${max}`;
    }
    case 'boolean':
      return `z.boolean()`;
    default:
      throw new Error(`${ctx}: unsupported type ${JSON.stringify(node.type)}`);
  }
}

/** Direct `$ref` dependencies, so definitions can be emitted before their users. */
function dependencies(
  node: unknown,
  found: Set<string> = new Set(),
): Set<string> {
  if (Array.isArray(node)) {
    for (const child of node) {
      dependencies(child, found);
    }
  } else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') {
        found.add(refName(value));
      } else {
        dependencies(value, found);
      }
    }
  }
  return found;
}

function topoSort(defs: Record<string, JsonSchema>): string[] {
  const order: string[] = [];
  const done = new Set<string>();
  const inProgress = new Set<string>();

  const visit = (name: string, trail: string[]) => {
    if (done.has(name)) {
      return;
    }
    if (inProgress.has(name)) {
      throw new Error(`Cyclic $ref: ${[...trail, name].join(' -> ')}`);
    }
    inProgress.add(name);
    for (const dep of dependencies(defs[name])) {
      if (defs[dep] === undefined) {
        throw new Error(`${name} refers to unknown definition ${dep}`);
      }
      visit(dep, [...trail, name]);
    }
    inProgress.delete(name);
    done.add(name);
    order.push(name);
  };

  for (const name of Object.keys(defs).sort()) {
    visit(name, []);
  }
  return order;
}

function generate(doc: Document, rootName: string, sourceFile: string): string {
  const defs = doc.$defs ?? doc.definitions ?? {};
  const lines: string[] = [
    `// Generated from ${sourceFile} by scripts/generate-etv-schemas.ts.`,
    `// Do not edit. Refinements belong in the hand-written files one level up.`,
    ``,
    `import { z } from 'zod/v4';`,
    ``,
  ];

  for (const name of topoSort(defs)) {
    const def = defs[name];
    if (def.description !== undefined) {
      const summary = def.description.split('\n')[0];
      lines.push(`/** ${summary} */`);
    }
    lines.push(`export const ${schemaConst(name)} = ${render(def, name)};`);
    lines.push(`export type ${name} = z.infer<typeof ${schemaConst(name)}>;`);
    lines.push(``);
  }

  const root = { ...doc };
  delete root.$defs;
  delete root.definitions;
  lines.push(
    `export const ${schemaConst(rootName)} = ${render(root, rootName)};`,
  );
  lines.push(
    `export type ${rootName} = z.infer<typeof ${schemaConst(rootName)}>;`,
  );
  lines.push(``);

  return lines.join('\n');
}

export const documents = [
  { file: 'playout.json', out: 'playout.ts', root: 'Playout' },
  {
    file: 'channel_config.json',
    out: 'channelConfig.ts',
    root: 'ChannelConfig',
  },
  { file: 'lineup_config.json', out: 'lineupConfig.ts', root: 'LineupConfig' },
];

/** Renders one document exactly as the generator writes it, for the staleness test. */
export async function renderDocument(file: string, root: string) {
  const doc = JSON.parse(
    await fs.readFile(path.join(schemaDir, file), 'utf-8'),
  ) as Document;
  const source = await prettier.format(generate(doc, root, `schema/${file}`), {
    ...(await prettier.resolveConfig(outDir)),
    parser: 'typescript',
  });
  return {
    source,
    defCount: Object.keys(doc.$defs ?? doc.definitions ?? {}).length,
  };
}

export async function writeAll() {
  await fs.mkdir(outDir, { recursive: true });

  for (const { file, out, root } of documents) {
    const { source, defCount } = await renderDocument(file, root);
    await fs.writeFile(path.join(outDir, out), source, 'utf-8');
    console.log(
      `${file} -> generated/${out} (${defCount} definitions, ${source.length} bytes)`,
    );
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  await writeAll();
}
