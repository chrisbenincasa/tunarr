import { Libx264Encoder } from './Libx264Encoder.ts';

describe('Libx264Encoder', () => {
  test('outputs -c:v libx264 as base options', () => {
    const encoder = new Libx264Encoder(null, null);
    expect(encoder.options()).toEqual(['-c:v', 'libx264']);
  });

  test('outputs -preset:v when videoPreset is set', () => {
    const encoder = new Libx264Encoder(null, 'veryfast');
    expect(encoder.options()).toContain('-preset:v');
    expect(encoder.options()).toContain('veryfast');

    const presetIdx = encoder.options().indexOf('-preset:v');
    expect(encoder.options()[presetIdx + 1]).toBe('veryfast');
  });

  test('outputs -profile:v when videoProfile is set', () => {
    const encoder = new Libx264Encoder('main', null);
    expect(encoder.options()).toContain('-profile:v');
    expect(encoder.options()).toContain('main');

    const profileIdx = encoder.options().indexOf('-profile:v');
    expect(encoder.options()[profileIdx + 1]).toBe('main');
  });

  test('outputs both preset and profile when both are set', () => {
    const encoder = new Libx264Encoder('main', 'veryfast');
    const opts = encoder.options();

    expect(opts).toEqual([
      '-c:v',
      'libx264',
      '-preset:v',
      'veryfast',
      '-profile:v',
      'main',
    ]);
  });

  test('does not output -preset:v when videoPreset is null', () => {
    const encoder = new Libx264Encoder('main', null);
    expect(encoder.options()).not.toContain('-preset:v');
  });

  test('does not output -preset:v when videoPreset is empty string', () => {
    const encoder = new Libx264Encoder(null, '');
    expect(encoder.options()).not.toContain('-preset:v');
  });

  test('does not output -profile:v when videoProfile is null', () => {
    const encoder = new Libx264Encoder(null, 'veryfast');
    expect(encoder.options()).not.toContain('-profile:v');
  });
});
