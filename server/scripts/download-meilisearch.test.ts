import { describe, expect, test } from 'vitest';
import {
  ShippedMeilisearchPlatforms,
  findMissingMeilisearchAssets,
  meilisearchAssetFor,
} from './download-meilisearch.ts';

describe('meilisearchAssetFor', () => {
  test('maps every shipped platform to an upstream asset', () => {
    for (const [platform, arch] of ShippedMeilisearchPlatforms) {
      expect(
        meilisearchAssetFor(platform, arch),
        `${platform}/${arch}`,
      ).not.toBeNull();
    }
  });

  test('maps Apple Silicon to the apple-silicon asset', () => {
    expect(meilisearchAssetFor('darwin', 'arm64')).toEqual({
      meilisearchPlatform: 'macos',
      meilisearchArch: 'apple-silicon',
    });
  });

  test('returns null for an unsupported platform', () => {
    expect(meilisearchAssetFor('freebsd', 'x64')).toBeNull();
  });
});

describe('findMissingMeilisearchAssets', () => {
  test('returns nothing when every asset exists', async () => {
    const urls: string[] = [];
    const missing = await findMissingMeilisearchAssets('1.56.1', (url) => {
      urls.push(url);
      return Promise.resolve(true);
    });
    expect(missing).toEqual([]);
    expect(urls).toHaveLength(ShippedMeilisearchPlatforms.length);
  });

  test('reports the asset upstream left out of a release', async () => {
    const missing = await findMissingMeilisearchAssets('1.56.2', (url) =>
      Promise.resolve(!url.endsWith('-macos-apple-silicon')),
    );
    expect(missing).toEqual([
      'https://github.com/meilisearch/meilisearch/releases/download/v1.56.2/meilisearch-macos-apple-silicon',
    ]);
  });
});
