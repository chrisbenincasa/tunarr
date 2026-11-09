// @ts-check

// Posts pull request, issue, and release updates to a Discord webhook.
//
// Runs under pull_request_target and never checks out PR code. PR and issue
// text comes from the event payload and only ever lands in the JSON body.

const COLORS = {
  opened: 0x0969da,
  merged: 0x8250df,
  closed: 0x6e7781,
  fixed: 0x1f883d,
  release: 0xbf8700,
};

// Conventional-commit types that users don't need to hear about.
const QUIET_TITLE = /^(chore|ci|docs|build|test|style|refactor)(\([^)]*\))?!?:/i;

const BUG_LABELS = new Set(['bug', 'user-issue']);
const TITLE_LIMIT = 256;
const RELEASE_NOTES_LIMIT = 1500;

/**
 * @param {string} text
 * @param {number} limit
 */
function truncate(text, limit) {
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

/** @param {{ login: string, type?: string } | null | undefined} user */
function isBot(user) {
  return !user || user.type === 'Bot' || user.login.endsWith('[bot]');
}

/** @param {{ login: string, avatar_url: string, html_url: string }} user */
function author(user) {
  return { name: user.login, icon_url: user.avatar_url, url: user.html_url };
}

/** @param {Array<{ name: string }> | undefined} labels */
function labelFields(labels) {
  if (!labels || labels.length === 0) {
    return [];
  }
  return [{ name: 'Labels', value: labels.map((l) => l.name).join(', '), inline: true }];
}

/**
 * @param {string} verb
 * @param {{ number: number, title: string }} item
 */
function itemTitle(verb, item) {
  return truncate(`${verb} #${item.number}: ${item.title}`, TITLE_LIMIT);
}

/** @param {any} payload */
function pullRequestEmbed(payload) {
  const pr = payload.pull_request;
  if (isBot(pr.user) || pr.draft || QUIET_TITLE.test(pr.title)) {
    return null;
  }

  if (payload.action === 'opened' || payload.action === 'ready_for_review') {
    return {
      title: itemTitle('New PR', pr),
      url: pr.html_url,
      color: COLORS.opened,
      author: author(pr.user),
      description:
        pr.author_association === 'FIRST_TIME_CONTRIBUTOR' ? 'First contribution to Tunarr' : undefined,
      fields: labelFields(pr.labels),
    };
  }

  if (payload.action === 'closed' && pr.merged) {
    return {
      title: itemTitle('Merged', pr),
      url: pr.html_url,
      color: COLORS.merged,
      author: author(pr.user),
      description: pr.merged_by ? `Merged by ${pr.merged_by.login}` : undefined,
    };
  }

  if (payload.action === 'closed') {
    return {
      title: itemTitle('Closed', pr),
      url: pr.html_url,
      color: COLORS.closed,
      author: author(pr.user),
      description: `Closed without merging by ${payload.sender.login}`,
    };
  }

  return null;
}

/**
 * @param {any} closer
 */
function closerText(closer) {
  if (!closer) {
    return undefined;
  }
  if (closer.__typename === 'PullRequest') {
    return `Closed by [#${closer.number}](${closer.url}): ${closer.title}`;
  }
  if (closer.__typename === 'Commit') {
    return `Closed by commit [${closer.abbreviatedOid}](${closer.url})`;
  }
  return undefined;
}

/**
 * @param {any} payload
 * @param {any} closer The PR or commit that closed the issue, if known.
 */
function issueEmbed(payload, closer) {
  const issue = payload.issue;
  if (isBot(issue.user)) {
    return null;
  }

  if (payload.action === 'opened') {
    return {
      title: itemTitle('New issue', issue),
      url: issue.html_url,
      color: COLORS.opened,
      author: author(issue.user),
      fields: labelFields(issue.labels),
    };
  }

  if (payload.action !== 'closed') {
    return null;
  }

  if (issue.state_reason === 'completed') {
    const isBug = (issue.labels ?? []).some((/** @type {{ name: string }} */ l) => BUG_LABELS.has(l.name));
    return {
      title: itemTitle(isBug ? 'Fixed' : 'Completed', issue),
      url: issue.html_url,
      color: COLORS.fixed,
      author: author(issue.user),
      description: closerText(closer),
    };
  }

  const verb =
    issue.state_reason === 'not_planned'
      ? 'Closed as not planned'
      : issue.state_reason === 'duplicate'
        ? 'Closed as duplicate'
        : 'Closed';
  return {
    title: itemTitle(verb, issue),
    url: issue.html_url,
    color: COLORS.closed,
    author: author(issue.user),
  };
}

/** @param {any} payload */
function releaseEmbed(payload) {
  const release = payload.release;
  if (payload.action !== 'published') {
    return null;
  }

  const name = release.name || release.tag_name;
  const notes = (release.body ?? '').trim();
  const excerpt =
    notes.length > RELEASE_NOTES_LIMIT ? `${truncate(notes, RELEASE_NOTES_LIMIT)}\n\n[Full release notes](${release.html_url})` : notes;

  return {
    title: truncate(release.prerelease ? `Tunarr ${name} prerelease` : `Tunarr ${name} released`, TITLE_LIMIT),
    url: release.html_url,
    color: COLORS.release,
    description: excerpt || undefined,
  };
}

/**
 * Builds the Discord embed for an event, or returns null to stay quiet.
 *
 * @param {string} eventName
 * @param {any} payload
 * @param {any} [closer]
 */
function buildEmbed(eventName, payload, closer) {
  switch (eventName) {
    case 'pull_request_target':
    case 'pull_request':
      return pullRequestEmbed(payload);
    case 'issues':
      return issueEmbed(payload, closer);
    case 'release':
      return releaseEmbed(payload);
    default:
      return null;
  }
}

/**
 * Looks up the PR or commit that closed an issue. Returns undefined on any
 * failure, because the post is still useful without it.
 *
 * @param {any} github
 * @param {{ owner: string, repo: string }} repo
 * @param {number} number
 */
async function findCloser(github, repo, number) {
  try {
    const result = await github.graphql(
      `query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            timelineItems(itemTypes: [CLOSED_EVENT], last: 1) {
              nodes {
                ... on ClosedEvent {
                  closer {
                    __typename
                    ... on PullRequest { number title url }
                    ... on Commit { abbreviatedOid url }
                  }
                }
              }
            }
          }
        }
      }`,
      { owner: repo.owner, repo: repo.repo, number },
    );
    return result.repository.issue.timelineItems.nodes[0]?.closer ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {{ github: any, context: any, core: any, fetch?: typeof globalThis.fetch }} args
 */
async function notify({ github, context, core, fetch = globalThis.fetch }) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    core.warning('DISCORD_WEBHOOK_URL is not set. Skipping.');
    return;
  }

  const { eventName, payload } = context;
  const needsCloser =
    eventName === 'issues' && payload.action === 'closed' && payload.issue.state_reason === 'completed';
  const closer = needsCloser ? await findCloser(github, context.repo, payload.issue.number) : undefined;

  const embed = buildEmbed(eventName, payload, closer);
  if (!embed) {
    core.info(`Nothing to post for ${eventName}.${payload.action}.`);
    return;
  }

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
  });
  if (!response.ok) {
    core.setFailed(`Discord returned ${response.status}: ${await response.text()}`);
    return;
  }
  core.info(`Posted: ${embed.title}`);
}

module.exports = { buildEmbed, closerText, findCloser, notify, truncate };
