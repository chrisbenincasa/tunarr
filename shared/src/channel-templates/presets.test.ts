import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { BuiltInPresets } from './presets.js';

const UuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('BuiltInPresets', () => {
  // The web app imports this module, so it cannot depend on Node built-ins.
  test('imports no Node built-ins', () => {
    const source = readFileSync(
      new URL('./presets.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/from ['"]node:/);
  });

  test('gives every slot a UUID', () => {
    const ids = BuiltInPresets.flatMap((p) =>
      p.scheduleConfig.slots.map((s) => s.id),
    );
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(id).toMatch(UuidPattern);
    }
  });
});
