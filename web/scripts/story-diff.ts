/**
 * Screenshots every Storybook story on the current tree and on a base ref,
 * under each scheme and density, and writes an HTML report of the stories
 * that changed.
 *
 *   pnpm story-diff [--base <ref>] [--filter <text>]
 *
 * Output goes to web/story-diff/. Branch screenshots stay in
 * web/story-diff/shots/branch/ after the run, for attaching to PRs.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright';
import type { Browser } from 'playwright';
import { PNG } from 'pngjs';

const SCHEMES = ['dark', 'light'] as const;
const DENSITIES = ['comfortable', 'dense'] as const;
const VIEWPORT = { width: 1280, height: 800 };
const CONCURRENCY = 4;

type Story = { id: string; title: string; name: string };
type Shot = { story: Story; variant: string; file: string };
type Status = 'changed' | 'added' | 'removed';
type Result = { story: Story; variant: string; status: Status; file: string };

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: 'origin/main' },
    filter: { type: 'string' },
  },
});

const webDir = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(webDir, '..');
const outDir = path.join(webDir, 'story-diff');
const shotsDir = path.join(outDir, 'shots');

function run(cmd: string, cmdArgs: string[], cwd: string) {
  const result = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${cmdArgs.join(' ')} failed in ${cwd}`);
  }
}

function git(cmdArgs: string[]) {
  const result = spawnSync('git', cmdArgs, { cwd: repoRoot, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`git ${cmdArgs.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function buildStorybook(webPackageDir: string, dest: string) {
  run(
    'pnpm',
    ['exec', 'storybook', 'build', '--quiet', '-o', dest],
    webPackageDir,
  );
}

// Base builds are cached by commit, so repeat runs against the same base skip
// the build. Returns undefined when the base has no Storybook.
async function buildBase(ref: string): Promise<string | undefined> {
  const sha = git(['rev-parse', '--verify', `${ref}^{commit}`]);
  const dest = path.join(outDir, 'builds', `base-${sha.slice(0, 12)}`);
  if (existsSync(path.join(dest, 'index.json'))) {
    console.log(`Reusing base build for ${ref} (${sha.slice(0, 12)})`);
    return dest;
  }

  const hasStorybook =
    spawnSync('git', ['cat-file', '-e', `${sha}:web/.storybook/main.ts`], {
      cwd: repoRoot,
    }).status === 0;
  if (!hasStorybook) {
    console.log(`${ref} has no Storybook. Every story counts as added.`);
    return undefined;
  }

  const tree = await fs.mkdtemp(path.join(os.tmpdir(), 'story-diff-base-'));
  git(['worktree', 'add', '--detach', tree, sha]);
  try {
    run('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], tree);
    run(
      'pnpm',
      ['turbo', 'build', '--filter=@tunarr/types', '--filter=@tunarr/shared'],
      tree,
    );
    buildStorybook(path.join(tree, 'web'), dest);
  } finally {
    git(['worktree', 'remove', '--force', tree]);
  }
  return dest;
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

// Storybook's static output loads ES modules, which browsers refuse over
// file://, so each build gets a throwaway local server.
async function serve(root: string) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(
      new URL(req.url ?? '/', 'http://x').pathname,
    );
    const file = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file).then(
      (body) => {
        const type =
          CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type }).end(body);
      },
      () => res.writeHead(404).end(),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}

async function readStories(buildDir: string): Promise<Story[]> {
  const index = JSON.parse(
    await fs.readFile(path.join(buildDir, 'index.json'), 'utf8'),
  ) as { entries: Record<string, Story & { type: string }> };
  return Object.values(index.entries)
    .filter((entry) => entry.type === 'story')
    .filter((entry) => !args.filter || entry.id.includes(args.filter))
    .map(({ id, title, name }) => ({ id, title, name }));
}

async function screenshotAll(
  browser: Browser,
  buildDir: string,
  dest: string,
): Promise<Map<string, Shot>> {
  const stories = await readStories(buildDir);
  const jobs = stories.flatMap((story) =>
    SCHEMES.flatMap((scheme) =>
      DENSITIES.map((density) => ({ story, scheme, density })),
    ),
  );
  await fs.mkdir(dest, { recursive: true });
  const server = await serve(buildDir);
  const shots = new Map<string, Shot>();

  // MUI persists the scheme in localStorage and syncs it across tabs, so each
  // worker needs its own context or parallel stories flip each other's scheme.
  const worker = async () => {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    for (let job = jobs.shift(); job !== undefined; job = jobs.shift()) {
      const variant = `${job.scheme}-${job.density}`;
      const key = `${job.story.id}--${variant}`;
      const file = path.join(dest, `${key}.png`);
      const globals = `scheme:${job.scheme};density:${job.density}`;
      await page.goto(
        `${server.url}/iframe.html?id=${job.story.id}&viewMode=story&globals=${globals}`,
        { waitUntil: 'networkidle' },
      );

      // Storybook sets one of these classes once the story renders or throws.
      await page.waitForFunction(
        () =>
          document.body.classList.contains('sb-show-main') ||
          document.body.classList.contains('sb-show-errordisplay'),
      );
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: file,
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
      });
      shots.set(key, { story: job.story, variant, file });
    }
    await context.close();
  };

  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } finally {
    server.close();
  }
  return shots;
}

async function readPng(file: string) {
  return PNG.sync.read(await fs.readFile(file));
}

// Pads both images to a shared size so a story that grew or shrank still
// diffs instead of erroring.
function padTo(png: PNG, width: number, height: number) {
  if (png.width === width && png.height === height) {
    return png.data;
  }
  const out = new PNG({ width, height });
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out.data;
}

async function diffShots(
  base: Map<string, Shot>,
  branch: Map<string, Shot>,
  diffDir: string,
): Promise<Result[]> {
  await fs.mkdir(diffDir, { recursive: true });
  const results: Result[] = [];
  for (const [key, shot] of branch) {
    const baseShot = base.get(key);
    if (baseShot === undefined) {
      results.push({ ...shot, status: 'added', file: key });
      continue;
    }
    const [a, b] = await Promise.all([
      readPng(baseShot.file),
      readPng(shot.file),
    ]);
    const width = Math.max(a.width, b.width);
    const height = Math.max(a.height, b.height);
    const diff = new PNG({ width, height });
    const changedPixels = pixelmatch(
      padTo(a, width, height),
      padTo(b, width, height),
      diff.data,
      width,
      height,
      { threshold: 0.1 },
    );
    if (changedPixels > 0) {
      await fs.writeFile(
        path.join(diffDir, `${key}.png`),
        PNG.sync.write(diff),
      );
      results.push({ ...shot, status: 'changed', file: key });
    }
  }
  for (const [key, shot] of base) {
    if (!branch.has(key)) {
      results.push({ ...shot, status: 'removed', file: key });
    }
  }
  return results;
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function renderReport(results: Result[], baseRef: string) {
  const order: Status[] = ['changed', 'added', 'removed'];
  const img = (dir: string, file: string, label: string) =>
    `<figure><figcaption>${label}</figcaption><img loading="lazy" src="shots/${dir}/${encodeURIComponent(file)}.png"></figure>`;
  const sections = order.map((status) => {
    const rows = results
      .filter((r) => r.status === status)
      .sort((x, y) =>
        (x.story.id + x.variant).localeCompare(y.story.id + y.variant),
      )
      .map((r) => {
        const figures = [
          status !== 'added' ? img('base', r.file, 'Base') : '',
          status !== 'removed' ? img('branch', r.file, 'Branch') : '',
          status === 'changed' ? img('diff', r.file, 'Diff') : '',
        ].join('');
        return `<article><h3>${escapeHtml(`${r.story.title} / ${r.story.name}`)} <small>${r.variant}</small></h3><div class="row">${figures}</div></article>`;
      });
    return `<h2>${status} (${rows.length})</h2>${rows.join('') || '<p>None.</p>'}`;
  });

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Story diff</title>
<style>
  body { font: 14px system-ui, sans-serif; margin: 24px; background: #f4f4f5; color: #18181b; }
  h2 { text-transform: capitalize; border-bottom: 1px solid #d4d4d8; padding-bottom: 4px; }
  article { background: #fff; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
  h3 { margin: 0 0 8px; font-size: 14px; } small { color: #71717a; font-weight: normal; }
  .row { display: flex; gap: 12px; overflow-x: auto; }
  figure { margin: 0; flex: 1 1 0; min-width: 0; }
  figcaption { font-size: 12px; color: #71717a; margin-bottom: 4px; }
  img { max-width: 100%; border: 1px solid #e4e4e7; }
</style></head><body>
<h1>Story diff against ${escapeHtml(baseRef)}</h1>
${sections.join('\n')}
</body></html>`;
}

async function main() {
  const baseRef = args.base ?? 'origin/main';
  await fs.rm(shotsDir, { recursive: true, force: true });

  const baseBuild = await buildBase(baseRef);
  const branchBuild = path.join(outDir, 'builds', 'branch');
  await fs.rm(branchBuild, { recursive: true, force: true });
  buildStorybook(webDir, branchBuild);

  const browser = await chromium.launch();
  try {
    const base = baseBuild
      ? await screenshotAll(browser, baseBuild, path.join(shotsDir, 'base'))
      : new Map<string, Shot>();
    const branch = await screenshotAll(
      browser,
      branchBuild,
      path.join(shotsDir, 'branch'),
    );
    const results = await diffShots(base, branch, path.join(shotsDir, 'diff'));

    const reportPath = path.join(outDir, 'report.html');
    await fs.writeFile(reportPath, renderReport(results, baseRef));
    const count = (s: Status) => results.filter((r) => r.status === s).length;
    console.log(
      `\n${branch.size} branch shots. ${count('changed')} changed, ${count('added')} added, ${count('removed')} removed.`,
    );
    console.log(`Report: ${reportPath}`);
  } finally {
    await browser.close();
  }
}

await main();
