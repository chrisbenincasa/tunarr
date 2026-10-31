import { describe, expect, test } from 'vitest';
import { redactMediaServerSecrets } from './redactSecrets.ts';

describe('redactMediaServerSecrets', () => {
  test('redacts query-string tokens', () => {
    expect(
      redactMediaServerSecrets(
        'http://plex:32400/a?X-Plex-Token=abc123&x=1 http://jf/b?api_key=def-456 http://emby/c?X-Emby-Token=ghi_789',
      ),
    ).toBe(
      'http://plex:32400/a?X-Plex-Token=REDACTED&x=1 http://jf/b?api_key=REDACTED http://emby/c?X-Emby-Token=REDACTED',
    );
  });

  test('redacts header lines', () => {
    expect(
      redactMediaServerSecrets(
        '["X-Plex-Token: abc123", "X-Emby-Token: def456"]',
      ),
    ).toBe('["X-Plex-Token: REDACTED", "X-Emby-Token: REDACTED"]');
  });

  test('redacts the token in a Jellyfin Authorization header', () => {
    expect(
      redactMediaServerSecrets(
        'Authorization: MediaBrowser Client="Tunarr", Token="abc123"',
      ),
    ).toBe('Authorization: MediaBrowser Client="Tunarr", Token="REDACTED"');
  });

  test('redacts a JSON-escaped Jellyfin token', () => {
    expect(
      redactMediaServerSecrets(
        '"MediaBrowser Client=\\"Tunarr\\", Token=\\"abc123\\""',
      ),
    ).toBe('"MediaBrowser Client=\\"Tunarr\\", Token=\\"REDACTED\\""');
  });
});
