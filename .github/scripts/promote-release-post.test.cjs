// Run with: node --test .github/scripts/promote-release-post.test.cjs

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.join(__dirname, 'promote-release-post.sh');

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd,
    encoding: 'utf8',
  });
}

// Builds a repo whose origin/main holds one draft post, runs the script in dry
// run mode, and returns the promoted post.
function promote(post, version = '2026.11.3') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-'));
  const origin = path.join(root, 'origin.git');
  const work = path.join(root, 'work');
  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  git(root, 'clone', '-q', origin, work);

  const dir = path.join(work, 'docs/blog/posts/next');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.md'), post);
  git(work, 'checkout', '-q', '-b', 'main');
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', 'draft');
  git(work, 'push', '-q', 'origin', 'main');

  execFileSync('bash', [SCRIPT, version], {
    cwd: work,
    env: {
      ...process.env,
      GITHUB_REPOSITORY: 'owner/repo',
      DRY_RUN: 'true',
      RELEASE_DATE: '2026-11-20',
    },
    stdio: 'pipe',
  });

  const result = fs.readFileSync(path.join(work, `docs/blog/posts/${version}/index.md`), 'utf8');
  fs.rmSync(root, { recursive: true, force: true });
  return result;
}

const frontMatter = '---\ndraft: true\ncategories:\n  - Releases\n---\n\n';

test('sets date and slug, drops draft, and moves the folder', () => {
  const out = promote(`${frontMatter}# Tunarr 2026.11.3: Profiles\n`);
  assert.match(out, /^---\ncategories:\n {2}- Releases\ndate: 2026-11-20\nslug: "2026.11.3"\n---\n/);
  assert.doesNotMatch(out, /draft:/);
});

test('replaces a guessed version in the title', () => {
  const out = promote(`${frontMatter}# Tunarr 2026.11.3: Profiles\n`, '2026.12.0');
  assert.match(out, /\n# Tunarr 2026\.12\.0: Profiles\n/);
});

test('replaces "next" in the title', () => {
  const out = promote(`${frontMatter}# Tunarr next: Profiles\n`);
  assert.match(out, /\n# Tunarr 2026\.11\.3: Profiles\n/);
});

test('leaves a title without a version alone', () => {
  const out = promote(`${frontMatter}# Tunarr Gets Profiles\n`);
  assert.match(out, /\n# Tunarr Gets Profiles\n/);
});

test('rewrites only the first title', () => {
  const out = promote(`${frontMatter}# Tunarr next: Profiles\n\nText\n\n# Tunarr next: elsewhere\n`);
  assert.match(out, /\n# Tunarr 2026\.11\.3: Profiles\n/);
  assert.match(out, /\n# Tunarr next: elsewhere\n/);
});
