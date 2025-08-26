/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
  branches: [
    {
      name: 'main',
    },
    {
      name: 'dev',
      prerelease: true,
      channel: 'next',
    },
    {
      name: 'media-scanner',
      prerelease: true,
      channel: 'media-scanner',
    },
  ],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/npm',
      {
        npmPublish: false,
      },
    ],
    '@semantic-release/github',
    '@semantic-release/changelog',
  ],
};
