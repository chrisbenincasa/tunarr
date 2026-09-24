import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  documents,
  renderDocument,
} from '../../../scripts/generate-etv-schemas.ts';
import { ChannelConfigSchema } from './generated/channelConfig.ts';
import { LineupConfigSchema } from './generated/lineupConfig.ts';
import { PlayoutSchema } from './generated/playout.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaDir = path.join(here, 'schema');
const generatedDir = path.join(here, 'generated');

const readSchemaFile = (name: string) =>
  fs.readFile(path.join(schemaDir, name), 'utf-8');

const loadExample = async () =>
  JSON.parse(await readSchemaFile('example-playout.json')) as Record<
    string,
    unknown
  >;

/**
 * `$schema` and `generated_at` are in upstream's example but in neither the
 * schema nor the Rust `Playout` struct, so `next` discards them. Strip them to
 * get the document the Rust side actually models.
 */
const exampleAsModelled = async () => {
  const {
    $schema: _schema,
    generated_at: _generatedAt,
    ...rest
  } = await loadExample();
  return rest;
};

describe('vendored ErsatzTV next schemas', () => {
  test('match the hashes recorded in the manifest', async () => {
    const manifest = JSON.parse(await readSchemaFile('manifest.json')) as {
      files: Record<string, string>;
    };

    for (const [name, expected] of Object.entries(manifest.files)) {
      const contents = await fs.readFile(path.join(schemaDir, name));
      const actual = createHash('sha256').update(contents).digest('hex');
      expect(actual, `${name} does not match the manifest`).toEqual(expected);
    }
  });

  test('the checked-in generated output is what the generator produces', async () => {
    for (const { file, out, root } of documents) {
      const { source } = await renderDocument(file, root);
      const checkedIn = await fs.readFile(
        path.join(generatedDir, out),
        'utf-8',
      );

      expect(
        checkedIn,
        `generated/${out} is stale — run pnpm generate-etv-schemas`,
      ).toEqual(source);
    }
  });
});

describe('PlayoutSchema', () => {
  test("parses upstream's own example playout", async () => {
    const result = PlayoutSchema.safeParse(await exampleAsModelled());

    expect(result.error?.issues).toBeUndefined();
    expect(result.success).toBe(true);
  });

  test('rejects the undeclared keys upstream ships in that example', async () => {
    const result = PlayoutSchema.safeParse(await loadExample());

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      code: 'unrecognized_keys',
      keys: ['$schema', 'generated_at'],
    });
  });

  test('catches a misspelled key instead of playing from the wrong offset', async () => {
    const playout = (await exampleAsModelled()) as {
      items: Record<string, Record<string, unknown>>[];
    };
    playout.items[0].source.in_point_msec = 5000;

    const result = PlayoutSchema.safeParse(playout);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toContain('in_point_msec');
  });

  test('routes sources through the source_type discriminator', async () => {
    const playout = (await exampleAsModelled()) as {
      items: Record<string, Record<string, unknown>>[];
    };
    playout.items[0].source.source_type = 'not_a_source';

    const result = PlayoutSchema.safeParse(playout);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].code).toBe('invalid_union');
  });

  test('requires an explicit UTC offset on start and finish', async () => {
    const playout = (await exampleAsModelled()) as {
      items: Record<string, unknown>[];
    };
    playout.items[0].start = '2026-02-23T20:00:00';

    const result = PlayoutSchema.safeParse(playout);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['items', 0, 'start']);
  });

  test('accepts every source variant', () => {
    const sources = [
      { source_type: 'local', path: '/media/a.mkv' },
      { source_type: 'lavfi', params: 'color=c=black' },
      { source_type: 'http', uri: 'http://example.com/a.m3u8' },
      { source_type: 'rtsp', uri: 'rtsp://example.com/stream' },
      { source_type: 'script', command: '/bin/cat' },
      { source_type: 'dynamic', uri: 'http://127.0.0.1:8000/api/etv/item' },
    ];

    for (const source of sources) {
      const result = PlayoutSchema.safeParse({
        version: 'https://ersatztv.org/playout/version/0.0.3',
        items: [
          {
            id: '1',
            start: '2026-02-23T20:00:00.000-05:00',
            finish: '2026-02-23T20:30:00.000-05:00',
            source,
          },
        ],
      });

      expect(result.error?.issues, source.source_type).toBeUndefined();
    }
  });
});

describe('ChannelConfigSchema', () => {
  test('accepts a minimal config and rejects an unknown root key', () => {
    const config = {
      ffmpeg: {},
      normalization: {
        video: { format: 'h264', width: 1920, height: 1080 },
        audio: { format: 'aac' },
      },
      playout: { folder: '/tmp/etv/1' },
    };

    expect(ChannelConfigSchema.safeParse(config).error?.issues).toBeUndefined();
    expect(
      ChannelConfigSchema.safeParse({ ...config, normalisation: {} }).success,
    ).toBe(false);
  });
});

describe('LineupConfigSchema', () => {
  test('is generated and parses its required shape', () => {
    expect(LineupConfigSchema.safeParse({}).success).toBe(false);
  });
});
