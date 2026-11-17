import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  acceptsSchemaVersion,
  findContractMismatches,
  parseDescribe,
} from './EtvNextDescribe.ts';
import { matchesPinnedEtvNextVersion } from './EtvNextVersion.ts';
import type { Describe } from './generated/describe.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The pinned worker's own `describe` output. */
const readExample = () =>
  fs.readFile(path.join(here, 'schema', 'example-describe.json'), 'utf-8');

const loadExample = async () => parseDescribe(await readExample());

const playoutUri = (version: string) =>
  `https://ersatztv.org/playout/version/${version}`;

describe('parseDescribe', () => {
  test('reads the pinned worker output', async () => {
    const described = await loadExample();

    expect(described.describe_version).toBe(1);
    expect(described.runtime_capability).toBeNull();
  });

  // A pin bump fails here until the fixture is recaptured from the new worker.
  test('the fixture comes from the pinned worker', async () => {
    const described = await loadExample();

    expect(matchesPinnedEtvNextVersion(described.binary.version)).toBe(true);
  });

  // Upstream adds fields without bumping describe_version.
  test('ignores fields it does not know', async () => {
    const raw = JSON.parse(await readExample()) as Record<string, unknown>;
    raw.something_new = { nested: true };

    expect(() => parseDescribe(JSON.stringify(raw))).not.toThrow();
  });

  test('throws on output that is not JSON', () => {
    expect(() => parseDescribe('ersatztv-channel 0.2.4+linux-x64')).toThrow();
  });

  test('throws when a required field is missing', async () => {
    const raw = JSON.parse(await readExample()) as Record<string, unknown>;
    delete raw.contract;

    expect(() => parseDescribe(JSON.stringify(raw))).toThrow();
  });
});

describe('acceptsSchemaVersion', () => {
  const accepted = { uri: playoutUri('0.0.8'), breaking: 0, compatible: 8 };

  test.each([
    ['the newest version', playoutUri('0.0.8'), true],
    ['an older compatible version', playoutUri('0.0.5'), true],
    ['a newer compatible version', playoutUri('0.0.9'), false],
    ['a different breaking version', playoutUri('0.1.0'), false],
    ['another schema', 'https://ersatztv.org/channel/version/0.0.8', false],
    ['a version that is not 0.x', playoutUri('1.0.8'), false],
    ['an unparseable version', 'garbage', false],
  ])('%s', (_, version, expected) => {
    expect(acceptsSchemaVersion(accepted, version)).toBe(expected);
  });
});

describe('findContractMismatches', () => {
  const withContract = (
    described: Describe,
    contract: Partial<Describe['contract']>,
  ): Describe => ({
    ...described,
    contract: { ...described.contract, ...contract },
  });

  test('the pinned worker matches Tunarr', async () => {
    expect(findContractMismatches(await loadExample())).toEqual([]);
  });

  test('refuses a describe_version it cannot read', async () => {
    const described = { ...(await loadExample()), describe_version: 2 };

    expect(findContractMismatches(described)).toEqual([
      expect.stringContaining('describe_version is 2'),
    ]);
  });

  test('flags a worker older than the playout schema Tunarr writes', async () => {
    const described = withContract(await loadExample(), {
      playout_schema: { uri: playoutUri('0.0.7'), breaking: 0, compatible: 7 },
    });

    expect(findContractMismatches(described)).toEqual([
      expect.stringContaining('playout schema'),
    ]);
  });

  test('flags a channel config schema with a new breaking version', async () => {
    const described = withContract(await loadExample(), {
      channel_config_schema: {
        uri: 'https://ersatztv.org/channel/version/0.2.0',
        breaking: 2,
        compatible: 0,
      },
    });

    expect(findContractMismatches(described)).toEqual([
      expect.stringContaining('channel config schema'),
    ]);
  });

  test('flags a renamed output file', async () => {
    const example = await loadExample();
    const described = withContract(example, {
      output_files: { ...example.contract.output_files, ready: '.done' },
    });

    expect(findContractMismatches(described)).toEqual([
      'output file ready: the worker writes .done, Tunarr expects .ready',
    ]);
  });

  test('flags a callback header Tunarr reads that the worker stopped sending', async () => {
    const example = await loadExample();
    const described = withContract(example, {
      dynamic_callback_headers:
        example.contract.dynamic_callback_headers.filter(
          (h) => h !== 'x-etv-now',
        ),
    });

    expect(findContractMismatches(described)).toEqual([
      'dynamic callbacks no longer send x-etv-now',
    ]);
  });
});
