import { sanitizeForExec } from './strings';

test('sanitizeForExec should remove bash metachars', () => {
  expect(sanitizeForExec('&|;<>"\'  $()\n ')).toBe('');
});

test('sanitizeForExec should not affect path-like strings', () => {
  expect(sanitizeForExec('/usr/bin/ffmpeg')).toBe('/usr/bin/ffmpeg');
});

describe('sanitizeForExec Windows', () => {
  let originalPlatform: PropertyDescriptor | undefined;
  beforeAll(() => {
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });
  });

  afterAll(() => {
    Object.defineProperty(process, 'platform', originalPlatform!);
  });

  test('preserve forward slashes in paths', () => {
    expect(sanitizeForExec('C:\\Downloads\\ffmpeg\\bin')).toBe(
      'C:\\Downloads\\ffmpeg\\bin',
    );
  });
});
