// Run with: node --test .github/scripts/discord-notify.test.cjs

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildEmbed, notify } = require('./discord-notify.cjs');

const alice = { login: 'alice', type: 'User', avatar_url: 'https://a/alice', html_url: 'https://gh/alice' };
const owner = { login: 'chrisbenincasa', type: 'User', avatar_url: 'https://a/c', html_url: 'https://gh/c' };
const dependabot = { login: 'dependabot[bot]', type: 'Bot', avatar_url: 'https://a/d', html_url: 'https://gh/d' };

function pr(overrides = {}) {
  return {
    number: 2420,
    title: 'fix(stream): send whole milliseconds',
    html_url: 'https://gh/pr/2420',
    user: alice,
    draft: false,
    merged: false,
    merged_by: null,
    author_association: 'CONTRIBUTOR',
    labels: [],
    ...overrides,
  };
}

function issue(overrides = {}) {
  return {
    number: 2416,
    title: 'Stream shows an error screen',
    html_url: 'https://gh/issues/2416',
    user: alice,
    labels: [],
    state_reason: null,
    ...overrides,
  };
}

const prEvent = (action, prOverrides) => ({ action, sender: owner, pull_request: pr(prOverrides) });
const issueEvent = (action, issueOverrides) => ({ action, sender: owner, issue: issue(issueOverrides) });

test('opened PR posts as new', () => {
  const embed = buildEmbed('pull_request_target', prEvent('opened'));
  assert.equal(embed.title, 'New PR #2420: fix(stream): send whole milliseconds');
  assert.equal(embed.author.name, 'alice');
  assert.equal(embed.description, undefined);
});

test('first-time contributor PR says so', () => {
  const embed = buildEmbed('pull_request_target', prEvent('opened', { author_association: 'FIRST_TIME_CONTRIBUTOR' }));
  assert.equal(embed.description, 'First contribution to Tunarr');
});

test('PR labels become a field', () => {
  const embed = buildEmbed('pull_request_target', prEvent('opened', { labels: [{ name: 'streaming' }, { name: 'bug' }] }));
  assert.deepEqual(embed.fields, [{ name: 'Labels', value: 'streaming, bug', inline: true }]);
});

test('draft PR is skipped when opened and when closed', () => {
  assert.equal(buildEmbed('pull_request_target', prEvent('opened', { draft: true })), null);
  assert.equal(buildEmbed('pull_request_target', prEvent('closed', { draft: true })), null);
});

test('draft marked ready posts as new', () => {
  const embed = buildEmbed('pull_request_target', prEvent('ready_for_review'));
  assert.match(embed.title, /^New PR #2420/);
});

test('bot PRs are skipped', () => {
  assert.equal(buildEmbed('pull_request_target', prEvent('opened', { user: dependabot })), null);
  assert.equal(buildEmbed('pull_request_target', prEvent('closed', { user: dependabot, merged: true })), null);
});

test('chore, ci, and docs PRs are skipped, including scoped and breaking forms', () => {
  for (const title of ['chore(deps): bump x', 'ci: retry', 'docs(plans): refresh', 'refactor!: drop y', 'CHORE: z']) {
    assert.equal(buildEmbed('pull_request_target', prEvent('opened', { title })), null, title);
  }
  assert.notEqual(buildEmbed('pull_request_target', prEvent('opened', { title: 'feat: chore wheel' })), null);
});

test('merged PR says merged and who merged it', () => {
  const embed = buildEmbed('pull_request_target', prEvent('closed', { merged: true, merged_by: owner }));
  assert.equal(embed.title, 'Merged #2420: fix(stream): send whole milliseconds');
  assert.equal(embed.description, 'Merged by chrisbenincasa');
});

test('closed PR says it was not merged and who closed it', () => {
  const embed = buildEmbed('pull_request_target', prEvent('closed'));
  assert.equal(embed.title, 'Closed #2420: fix(stream): send whole milliseconds');
  assert.equal(embed.description, 'Closed without merging by chrisbenincasa');
});

test('long titles are cut to Discord\'s 256-character limit', () => {
  const embed = buildEmbed('pull_request_target', prEvent('opened', { title: `fix: ${'x'.repeat(400)}` }));
  assert.equal(embed.title.length, 256);
  assert.ok(embed.title.endsWith('…'));
});

test('opened issue posts with labels', () => {
  const embed = buildEmbed('issues', issueEvent('opened', { labels: [{ name: 'user-issue' }] }));
  assert.equal(embed.title, 'New issue #2416: Stream shows an error screen');
  assert.equal(embed.fields[0].value, 'user-issue');
});

test('completed bug says fixed and names the closing PR', () => {
  const closer = { __typename: 'PullRequest', number: 2418, title: 'fix(stream): whole ms', url: 'https://gh/pr/2418' };
  const embed = buildEmbed('issues', issueEvent('closed', { state_reason: 'completed', labels: [{ name: 'user-issue' }] }), closer);
  assert.equal(embed.title, 'Fixed #2416: Stream shows an error screen');
  assert.equal(embed.description, 'Closed by [#2418](https://gh/pr/2418): fix(stream): whole ms');
});

test('completed non-bug says completed and can name a commit', () => {
  const closer = { __typename: 'Commit', abbreviatedOid: '07b68bd', url: 'https://gh/commit/07b68bd' };
  const embed = buildEmbed('issues', issueEvent('closed', { state_reason: 'completed' }), closer);
  assert.equal(embed.title, 'Completed #2416: Stream shows an error screen');
  assert.equal(embed.description, 'Closed by commit [07b68bd](https://gh/commit/07b68bd)');
});

test('completed issue without a known closer has no description', () => {
  const embed = buildEmbed('issues', issueEvent('closed', { state_reason: 'completed' }));
  assert.equal(embed.description, undefined);
});

test('issue close reasons map to titles', () => {
  const cases = { not_planned: 'Closed as not planned', duplicate: 'Closed as duplicate', reopened: 'Closed' };
  for (const [reason, verb] of Object.entries(cases)) {
    const embed = buildEmbed('issues', issueEvent('closed', { state_reason: reason }));
    assert.equal(embed.title, `${verb} #2416: Stream shows an error screen`);
  }
  assert.match(buildEmbed('issues', issueEvent('closed')).title, /^Closed #2416/);
});

test('bot issues are skipped', () => {
  assert.equal(buildEmbed('issues', issueEvent('opened', { user: dependabot })), null);
});

test('stable and prerelease releases are titled differently', () => {
  const release = { name: '2026.11.1', tag_name: 'v2026.11.1', html_url: 'https://gh/r', body: 'Notes', prerelease: false };
  assert.equal(buildEmbed('release', { action: 'published', release }).title, 'Tunarr 2026.11.1 released');
  const pre = { ...release, prerelease: true };
  assert.equal(buildEmbed('release', { action: 'published', release: pre }).title, 'Tunarr 2026.11.1 prerelease');
});

test('long release notes are cut and link to the full notes', () => {
  const release = { name: '', tag_name: 'v2026.11.1', html_url: 'https://gh/r', body: 'n'.repeat(5000), prerelease: false };
  const embed = buildEmbed('release', { action: 'published', release });
  assert.equal(embed.title, 'Tunarr v2026.11.1 released');
  assert.ok(embed.description.endsWith('[Full release notes](https://gh/r)'));
  assert.ok(embed.description.length < 4096);
});

function fakeCore() {
  const log = { warning: [], info: [], failed: [] };
  return {
    log,
    warning: (m) => log.warning.push(m),
    info: (m) => log.info.push(m),
    setFailed: (m) => log.failed.push(m),
  };
}

test('notify posts the embed with mentions disabled', async () => {
  process.env.DISCORD_WEBHOOK_URL = 'https://discord/webhook';
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true };
  };
  const core = fakeCore();
  const context = { eventName: 'pull_request_target', payload: prEvent('opened', { title: 'feat: ping @everyone' }) };
  await notify({ github: {}, context, core, fetch });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://discord/webhook');
  assert.deepEqual(calls[0].body.allowed_mentions, { parse: [] });
  assert.equal(calls[0].body.embeds[0].title, 'New PR #2420: feat: ping @everyone');
});

test('notify looks up the closer for completed issues and survives a failed lookup', async () => {
  process.env.DISCORD_WEBHOOK_URL = 'https://discord/webhook';
  const bodies = [];
  const fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return { ok: true };
  };
  const context = {
    eventName: 'issues',
    repo: { owner: 'chrisbenincasa', repo: 'tunarr' },
    payload: issueEvent('closed', { state_reason: 'completed' }),
  };

  const github = {
    graphql: async () => ({
      repository: { issue: { timelineItems: { nodes: [{ closer: { __typename: 'PullRequest', number: 1, title: 't', url: 'u' } }] } } },
    }),
  };
  await notify({ github, context, core: fakeCore(), fetch });
  assert.equal(bodies[0].embeds[0].description, 'Closed by [#1](u): t');

  const failing = { graphql: async () => { throw new Error('rate limited'); } };
  await notify({ github: failing, context, core: fakeCore(), fetch });
  assert.equal(bodies[1].embeds[0].description, undefined);
});

test('notify warns and skips when the webhook secret is missing', async () => {
  delete process.env.DISCORD_WEBHOOK_URL;
  const core = fakeCore();
  let called = false;
  await notify({ github: {}, context: { eventName: 'issues', payload: issueEvent('opened') }, core, fetch: async () => { called = true; } });
  assert.equal(called, false);
  assert.equal(core.log.warning.length, 1);
});

test('notify fails the job when Discord rejects the post', async () => {
  process.env.DISCORD_WEBHOOK_URL = 'https://discord/webhook';
  const core = fakeCore();
  const fetch = async () => ({ ok: false, status: 400, text: async () => 'bad embed' });
  await notify({ github: {}, context: { eventName: 'issues', payload: issueEvent('opened') }, core, fetch });
  assert.deepEqual(core.log.failed, ['Discord returned 400: bad embed']);
});
