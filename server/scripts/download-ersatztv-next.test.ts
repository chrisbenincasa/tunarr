import { describe, expect, test } from 'vitest';
import { etvTargetFor } from './download-ersatztv-next.ts';

// The six targets `make-bin.ts` builds, in its own vocabulary.
const tunarrTargets = [
  'linux-x64',
  'linux-arm64',
  'alpine-x64',
  'macos-x64',
  'macos-arm64',
  'win-x64',
] as const;

describe('etvTargetFor', () => {
  test.each(tunarrTargets)('maps the %s build target', (target) => {
    const [platform, arch] = target.split('-', 2);

    expect(etvTargetFor(platform, arch)).not.toBeNull();
  });

  test('sends Alpine to the musl build, not the glibc one', () => {
    expect(etvTargetFor('alpine', 'x64')).toBe('linux-musl-x64');
    expect(etvTargetFor('linux', 'x64')).toBe('linux-x64');
  });

  test('accepts the Node platform vocabulary as well as make-bin', () => {
    expect(etvTargetFor('darwin', 'arm64')).toBe(
      etvTargetFor('macos', 'arm64'),
    );
    expect(etvTargetFor('win32', 'x64')).toBe(etvTargetFor('win', 'x64'));
  });

  test('refuses a target upstream does not publish', () => {
    expect(etvTargetFor('linux', 'arm')).toBeNull();
    expect(etvTargetFor('freebsd', 'x64')).toBeNull();
    expect(etvTargetFor('win32', 'arm64')).toBeNull();
  });
});
