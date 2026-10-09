// @ts-check

// Enforces the machine-checkable parts of the contribution policy.
// See the "Pull Request Policy" and "AI Use" sections of docs/dev/contributing.md.
//
// Runs under pull_request_target and never checks out PR code. Everything it
// reads comes from the GitHub API.

const MARKER = '<!-- pr-policy-bot -->';
const POLICY_URL = 'https://tunarr.com/dev/contributing/#pull-request-policy';
const DISCLOSURE_URL = 'https://tunarr.com/dev/contributing/#disclose-ai-use';
const NEEDS_DESIGN = 'needs design';
const DESIGN_APPROVED = 'design approved';
const DESIGN_PROPOSAL = 'design proposal';
const SIZE_LIMIT = 500;
const SIZE_LIMIT_WITH_TESTS = 1500;
const CLOSE_AFTER_DAYS = 30;
const STATUS_CONTEXT = 'pr-policy';

// PRs opened before the policy took effect are not checked.
const POLICY_START = Date.parse('2026-10-10T00:00:00Z');

const GENERATED = [
  /^pnpm-lock\.yaml$/,
  /^server\/src\/migration\/db\/sql\/meta\//,
  /^server\/src\/generated\//,
  /^web\/src\/generated\//,
  /^docs\/generated\//,
  /^web\/src\/routeTree\.gen\.ts$/,
  /^web\/src\/locales\//,
];

const TESTS = [
  /\.test\.tsx?$/,
  /^e2e\//,
  /^server\/tests\//,
  /^web\/src\/test\//,
  /^server\/src\/resources\/test\//,
];

const MEDIA_SOURCE_TYPE_LINE =
  /^\+.*\b(MediaSourceTypes|RemoteSourceTypes|MediaSourceType)\b\s*=/;

// Maintainers are the users listed in .github/CODEOWNERS on the base branch.
async function maintainers(github, owner, repo, ref) {
  const { data } = await github.rest.repos.getContent({
    owner,
    repo,
    path: '.github/CODEOWNERS',
    ref,
  });
  if (Array.isArray(data) || data.type !== 'file') return new Set();
  const text = Buffer.from(data.content, 'base64').toString('utf8');
  const logins = new Set();
  for (const line of text.split('\n')) {
    const content = line.replace(/#.*/, '');
    for (const m of content.matchAll(/@([A-Za-z0-9-]+)(?![\w/-])/g)) {
      logins.add(m[1].toLowerCase());
    }
  }
  return logins;
}

async function isExempt(github, owner, repo, pr) {
  if (pr.user.type === 'Bot') return true;
  const logins = await maintainers(github, owner, repo, pr.base.sha);
  return logins.has(pr.user.login.toLowerCase());
}

function lineCounts(files) {
  const counted = files.filter((f) => !GENERATED.some((re) => re.test(f.filename)));
  const sum = (fs) => fs.reduce((n, f) => n + f.additions + f.deletions, 0);
  return {
    code: sum(counted.filter((f) => !TESTS.some((re) => re.test(f.filename)))),
    withTests: sum(counted),
  };
}

function addedMigrations(files) {
  return files
    .filter(
      (f) =>
        f.status === 'added' &&
        f.filename.startsWith('server/src/migration/') &&
        !f.filename.includes('/meta/') &&
        !f.filename.endsWith('.test.ts'),
    )
    .map((f) => f.filename);
}

async function readJson(github, owner, repo, path, ref) {
  try {
    const { data } = await github.rest.repos.getContent({ owner, repo, path, ref });
    if (Array.isArray(data) || data.type !== 'file') return undefined;
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  } catch (e) {
    if (e.status === 404) return undefined;
    throw e;
  }
}

async function addedRuntimeDependencies(github, owner, repo, pr, files) {
  const manifests = files.filter(
    (f) => f.filename.endsWith('package.json') && f.status !== 'removed',
  );
  const added = [];
  for (const f of manifests) {
    const before = await readJson(github, owner, repo, f.filename, pr.base.sha);
    const after = await readJson(github, owner, repo, f.filename, pr.head.sha);
    const oldDeps = Object.keys(before?.dependencies ?? {});
    for (const name of Object.keys(after?.dependencies ?? {})) {
      if (!oldDeps.includes(name)) added.push(`${name} (${f.filename})`);
    }
  }
  return added;
}

async function newMediaSourceSignals(github, owner, repo, pr, files) {
  const signals = [];

  for (const f of files) {
    const lines = (f.patch ?? '').split('\n');
    if (lines.some((l) => MEDIA_SOURCE_TYPE_LINE.test(l))) {
      signals.push(`media source type list changed in ${f.filename}`);
    }
  }

  const { data: external } = await github.rest.repos.getContent({
    owner,
    repo,
    path: 'server/src/external',
    ref: pr.base.sha,
  });
  const existingDirs = new Set(
    Array.isArray(external)
      ? external.filter((e) => e.type === 'dir').map((e) => e.name)
      : [],
  );
  const newDirs = new Set(
    files
      .filter((f) => f.status === 'added')
      .map((f) => f.filename.split('/'))
      .filter((p) => p.length > 4 && p.slice(0, 3).join('/') === 'server/src/external')
      .map((p) => p[3])
      .filter((dir) => !existingDirs.has(dir)),
  );
  for (const dir of newDirs) {
    signals.push(`new API client directory server/src/external/${dir}/`);
  }

  return signals;
}

async function evaluateTriggers(github, owner, repo, pr) {
  const files = await github.paginate(github.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pr.number,
    per_page: 100,
  });

  const triggers = [];

  const { code, withTests } = lineCounts(files);
  if (code > SIZE_LIMIT) {
    triggers.push(`${code} changed lines outside tests, over the ${SIZE_LIMIT}-line limit`);
  } else if (withTests > SIZE_LIMIT_WITH_TESTS) {
    triggers.push(
      `${withTests} changed lines including tests, over the ${SIZE_LIMIT_WITH_TESTS}-line limit`,
    );
  }
  for (const m of addedMigrations(files)) {
    triggers.push(`new migration ${m}`);
  }
  for (const d of await addedRuntimeDependencies(github, owner, repo, pr, files)) {
    triggers.push(`new runtime dependency ${d}`);
  }
  triggers.push(...(await newMediaSourceSignals(github, owner, repo, pr, files)));

  return triggers;
}

function referencedNumbers(body, owner, repo) {
  const numbers = new Set();
  for (const m of body.matchAll(/(?:^|[\s(])#(\d+)\b/g)) numbers.add(Number(m[1]));
  const url = new RegExp(`github\\.com/${owner}/${repo}/issues/(\\d+)`, 'gi');
  for (const m of body.matchAll(url)) numbers.add(Number(m[1]));
  return [...numbers];
}

async function linkedIssues(github, owner, repo, body) {
  const issues = [];
  for (const issue_number of referencedNumbers(body, owner, repo)) {
    try {
      const { data } = await github.rest.issues.get({ owner, repo, issue_number });
      if (!data.pull_request) issues.push(data);
    } catch (e) {
      if (e.status !== 404) throw e;
    }
  }
  return issues;
}

async function approvedDesignIssue(github, owner, repo, body) {
  for (const issue_number of referencedNumbers(body, owner, repo)) {
    try {
      const { data } = await github.rest.issues.get({ owner, repo, issue_number });
      const approved = data.labels.some(
        (l) => (typeof l === 'string' ? l : l.name) === DESIGN_APPROVED,
      );
      if (!data.pull_request && approved) return issue_number;
    } catch (e) {
      if (e.status !== 404) throw e;
    }
  }
  return undefined;
}

const AI_TOOL = /\b(claude|copilot|cursor|codex|gemini|aider|chatgpt|openai|anthropic|devin|windsurf)\b/i;

function aiUseSection(body) {
  const section = body.match(/^#{1,6}\s*AI use\s*$([\s\S]*?)(?=^#{1,6}\s|$(?![\s\S]))/im);
  if (!section) return '';
  return section[1].replace(/<!--[\s\S]*?-->/g, '').trim();
}

function hasDisclosure(body) {
  return aiUseSection(body).length > 0;
}

function deniesAiUse(body) {
  const text = aiUseSection(body);
  if (AI_TOOL.test(text)) return false;
  return /\bno ai\b/i.test(text) || /^(none|n\/a|no)\.?$/i.test(text);
}

// Tools named in AI attribution lines that agents add to commits and PR
// descriptions, such as "Co-Authored-By: Claude" or "Generated with Copilot".
function attributedTools(texts) {
  const tools = new Set();
  for (const text of texts) {
    for (const line of text.split('\n')) {
      if (!/^\s*co-authored-by:|generated (with|by)/i.test(line)) continue;
      const m = line.match(AI_TOOL);
      if (m) tools.add(m[1].toLowerCase());
    }
  }
  return [...tools];
}

async function commitMessages(github, owner, repo, number) {
  const commits = await github.paginate(github.rest.pulls.listCommits, {
    owner,
    repo,
    pull_number: number,
    per_page: 100,
  });
  return commits.map((c) => c.commit.message);
}

function commentBody({ triggers, designIssue, disclosed, deniedTools = [] }) {
  const parts = [MARKER];
  const designBlocked = triggers.length > 0 && designIssue === undefined;

  if (!designBlocked && disclosed && deniedTools.length === 0) {
    parts.push('This PR meets the contribution policy checks. Thanks!');
    return parts.join('\n\n');
  }

  parts.push(`This PR doesn't yet meet the [contribution policy](${POLICY_URL}).`);

  if (designBlocked) {
    parts.push(
      [
        'This change needs an approved design before review, because of:',
        '',
        ...triggers.map((t) => `- ${t}`),
        '',
        `It has been converted to a draft and labeled \`${NEEDS_DESIGN}\`. To move forward, open an issue describing the design, wait for a maintainer to label it \`${DESIGN_APPROVED}\`, then link it in the "Design issue" section of this PR's description. Once the design is approved, rework or split this PR to match it and mark it ready for review.`,
        '',
        `PRs labeled \`${NEEDS_DESIGN}\` are closed after ${CLOSE_AFTER_DAYS} days without an approved design.`,
      ].join('\n'),
    );
  }

  if (!disclosed) {
    parts.push(
      `The "AI use" section of the description is missing or empty. Say which AI tools you used and what they did, or write "No AI tools used". See [Disclose AI use](${DISCLOSURE_URL}).`,
    );
  } else if (deniedTools.length > 0) {
    parts.push(
      `The "AI use" section says no AI tools were used, but this PR's commits or description credit ${deniedTools.join(', ')}. Please update the "AI use" section to say what those tools did. See [Disclose AI use](${DISCLOSURE_URL}).`,
    );
  }

  return parts.join('\n\n');
}

async function upsertComment(github, owner, repo, number, body) {
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: number,
    per_page: 100,
  });
  const existing = comments.find((c) => c.body?.startsWith(MARKER));
  if (existing) {
    if (existing.body !== body) {
      await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
    }
  } else if (!body.includes('meets the contribution policy')) {
    await github.rest.issues.createComment({ owner, repo, issue_number: number, body });
  }
}

async function evaluatePullRequest(github, core, owner, repo, number) {
  const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: number });

  if (Date.parse(pr.created_at) < POLICY_START) {
    core.info(`Skipping: #${pr.number} was opened before the policy took effect.`);
    return;
  }

  if (await isExempt(github, owner, repo, pr)) {
    core.info(`Skipping: ${pr.user.login} is a bot or listed in CODEOWNERS.`);
    return;
  }

  const body = pr.body ?? '';
  const hasLabel = pr.labels.some((l) => l.name === NEEDS_DESIGN);
  const triggers = await evaluateTriggers(github, owner, repo, pr);

  // A maintainer may apply the label by hand for triggers the bot can't
  // detect. Only an approved design clears it.
  if (hasLabel && triggers.length === 0) {
    triggers.push(`a maintainer marked this change as needing a design`);
  }

  const designIssue =
    triggers.length > 0 ? await approvedDesignIssue(github, owner, repo, body) : undefined;
  const disclosed = hasDisclosure(body);
  const deniedTools = deniesAiUse(body)
    ? attributedTools([body, ...(await commitMessages(github, owner, repo, pr.number))])
    : [];
  const designBlocked = triggers.length > 0 && designIssue === undefined;

  core.info(`Triggers: ${triggers.length ? triggers.join('; ') : 'none'}`);
  core.info(`Approved design issue: ${designIssue ?? 'none'}`);
  core.info(`Disclosure present: ${disclosed}`);
  core.info(`Credited tools contradicting disclosure: ${deniedTools.join(', ') || 'none'}`);

  if (designBlocked) {
    if (!hasLabel) {
      await github.rest.issues.addLabels({
        owner,
        repo,
        issue_number: pr.number,
        labels: [NEEDS_DESIGN],
      });
    }
    if (!pr.draft) {
      try {
        await github.graphql(
          'mutation($id: ID!) { convertPullRequestToDraft(input: {pullRequestId: $id}) { clientMutationId } }',
          { id: pr.node_id },
        );
      } catch (e) {
        core.warning(`Could not convert PR to draft: ${e.message}`);
      }
    }
  } else if (hasLabel) {
    try {
      await github.rest.issues.removeLabel({
        owner,
        repo,
        issue_number: pr.number,
        name: NEEDS_DESIGN,
      });
    } catch (e) {
      if (e.status !== 404) throw e;
    }
  }

  await upsertComment(
    github,
    owner,
    repo,
    pr.number,
    commentBody({ triggers, designIssue, disclosed, deniedTools }),
  );

  // A commit status, not a job failure, carries the result. A run started by
  // an issue label can then update the PR's status.
  const passed = !designBlocked && disclosed && deniedTools.length === 0;
  await github.rest.repos.createCommitStatus({
    owner,
    repo,
    sha: pr.head.sha,
    state: passed ? 'success' : 'failure',
    context: STATUS_CONTEXT,
    description: passed ? 'Meets the contribution policy' : 'See the pr-policy bot comment',
    target_url: POLICY_URL,
  });
}

async function checkPullRequest({ github, context, core }) {
  const { owner, repo } = context.repo;
  await evaluatePullRequest(github, core, owner, repo, context.payload.pull_request.number);
}

// Runs when an issue is labeled `design approved`. Re-checks the open PRs
// waiting on a design that reference the issue.
async function recheckLinkedPullRequests({ github, context, core }) {
  if (context.payload.label?.name !== DESIGN_APPROVED) return;
  const { owner, repo } = context.repo;
  const issueNumber = context.payload.issue.number;

  const waiting = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: 'open',
    labels: NEEDS_DESIGN,
    per_page: 100,
  });
  for (const item of waiting.filter((i) => i.pull_request)) {
    if (!referencedNumbers(item.body ?? '', owner, repo).includes(issueNumber)) continue;
    core.info(`Re-checking #${item.number}, which references #${issueNumber}.`);
    await evaluatePullRequest(github, core, owner, repo, item.number);
  }
}


async function closeExpired({ github, context, core }) {
  const { owner, repo } = context.repo;
  const prs = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: 'open',
    labels: NEEDS_DESIGN,
    per_page: 100,
  });
  const cutoff = Date.now() - CLOSE_AFTER_DAYS * 24 * 60 * 60 * 1000;

  for (const item of prs.filter((i) => i.pull_request)) {
    const events = await github.paginate(github.rest.issues.listEvents, {
      owner,
      repo,
      issue_number: item.number,
      per_page: 100,
    });
    const labeled = events
      .filter((e) => e.event === 'labeled' && e.label?.name === NEEDS_DESIGN)
      .at(-1);
    if (!labeled) continue;
    if (await approvedDesignIssue(github, owner, repo, item.body ?? '')) continue;

    // The clock pauses while a linked design issue is open, because the PR is
    // waiting on a maintainer. A design closed without approval restarts it.
    const designs = (await linkedIssues(github, owner, repo, item.body ?? '')).filter((i) =>
      i.labels.some((l) => (typeof l === 'string' ? l : l.name) === DESIGN_PROPOSAL),
    );
    if (designs.some((d) => d.state === 'open')) continue;
    const clockStart = Math.max(
      Date.parse(labeled.created_at),
      ...designs.map((d) => Date.parse(d.closed_at)),
    );
    if (clockStart > cutoff) continue;

    core.info(`Closing #${item.number}: ${NEEDS_DESIGN} for over ${CLOSE_AFTER_DAYS} days.`);
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: item.number,
      body: `Closing because this PR has needed an approved design for over ${CLOSE_AFTER_DAYS} days. See the [contribution policy](${POLICY_URL}). Once a design issue is labeled \`${DESIGN_APPROVED}\`, open a new PR that links it.`,
    });
    await github.rest.pulls.update({ owner, repo, pull_number: item.number, state: 'closed' });
  }
}

module.exports = {
  checkPullRequest,
  recheckLinkedPullRequests,
  closeExpired,
  evaluateTriggers,
  approvedDesignIssue,
  hasDisclosure,
  maintainers,
  deniesAiUse,
  attributedTools,
  commentBody,
};
