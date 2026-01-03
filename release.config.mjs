/**
 * @type {import('semantic-release').GlobalConfig}
 */
export default {
  branches: [
    '+([0-9])?(.{+([0-9]),x}).x',
    'main',
    {
      name: 'dev',
      prerelease: 'dev',
      channel: 'dev',
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
