/**
 * Resolves Drizzle migration conflicts during a merge, rebase, or cherry-pick.
 *
 * Upstream's migrations win and keep their indices. This branch's migrations
 * are deleted and regenerated as one migration on top of upstream's latest
 * snapshot, then registered in DirectMigrationProvider.ts.
 *
 * Usage (from server/): pnpm resolve-migrations
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SQL_DIR = 'server/src/migration/db/sql';
const JOURNAL = `${SQL_DIR}/meta/_journal.json`;
const PROVIDER = 'server/src/migration/DirectMigrationProvider.ts';
const SCHEMA_DIR = 'server/src/db/schema/';
const REGISTRY_END = '} satisfies Record<string, TunarrDatabaseMigration>';

type JournalEntry = { idx: number; when: number; tag: string };
type Journal = { entries: JournalEntry[] };
type Snapshot = { id: string; prevId: string };

type Refs = {
  kind: 'merge' | 'rebase' | 'cherry-pick';
  upstream: string;
  ours: string;
  base: string;
};

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf-8',
}).trim();

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf-8' }).trim();
}

function hasRef(ref: string): boolean {
  return (
    spawnSync('git', ['rev-parse', '-q', '--verify', ref], { cwd: root })
      .status === 0
  );
}

function fail(message: string): never {
  console.error(`\nresolve-migrations: ${message}`);
  process.exit(1);
}

function abs(repoPath: string): string {
  return path.join(root, repoPath);
}

function snapshotPath(idx: number): string {
  return `${SQL_DIR}/meta/${String(idx).padStart(4, '0')}_snapshot.json`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Matches one registry entry for a SQL tag, including comment lines directly above it.
function entryRegex(tag: string): RegExp {
  return new RegExp(
    String.raw`\n[ \t]*(?:\/\/[^\n]*\n[ \t]*)*migration\d+:\s*makeMigrationFromSqlFile\(\s*'\.\/sql\/${escapeRegex(tag)}\.sql'\s*(?:,\s*(true|false)\s*)?,?\s*\),`,
  );
}

function detectRefs(): Refs {
  if (hasRef('MERGE_HEAD')) {
    return {
      kind: 'merge',
      upstream: 'MERGE_HEAD',
      ours: 'HEAD',
      base: git('merge-base', 'HEAD', 'MERGE_HEAD'),
    };
  }

  // During a rebase or cherry-pick, HEAD is the new base and the commit being
  // replayed carries this branch's migration.
  if (hasRef('REBASE_HEAD')) {
    return {
      kind: 'rebase',
      upstream: 'HEAD',
      ours: 'REBASE_HEAD',
      base: 'REBASE_HEAD^',
    };
  }
  if (hasRef('CHERRY_PICK_HEAD')) {
    return {
      kind: 'cherry-pick',
      upstream: 'HEAD',
      ours: 'CHERRY_PICK_HEAD',
      base: 'CHERRY_PICK_HEAD^',
    };
  }

  return fail(
    'no merge, rebase, or cherry-pick in progress. Start one, then run this when migrations conflict.',
  );
}

function readJournalAt(ref: string): Journal {
  return JSON.parse(git('show', `${ref}:${JOURNAL}`)) as Journal;
}

function readJson<T>(repoPath: string): T {
  return JSON.parse(fs.readFileSync(abs(repoPath), 'utf-8')) as T;
}

/**
 * Picks the provider text to edit, before anything on disk changes.
 * A conflicted provider is replaced with upstream's copy only when this
 * branch's sole change to it was registering its own SQL migrations.
 */
function planProvider(refs: Refs, ourOnly: JournalEntry[]) {
  const oursText = git('show', `${refs.ours}:${PROVIDER}`);

  const fullCopy = ourOnly.some(
    (e) => entryRegex(e.tag).exec(oursText)?.[1] === 'true',
  );

  const unregistered = ourOnly.filter((e) => !entryRegex(e.tag).test(oursText));

  const working = fs.readFileSync(abs(PROVIDER), 'utf-8');
  if (!/^<{7} /m.test(working)) {
    return { text: working, fullCopy, unregistered };
  }

  let stripped = oursText;
  for (const e of ourOnly) {
    stripped = stripped.replace(entryRegex(e.tag), '');
  }

  if (stripped !== git('show', `${refs.base}:${PROVIDER}`)) {
    return fail(
      `${PROVIDER} has conflicts and this branch changed more than its migration registrations. ` +
        'Resolve it by hand, keeping both sides, then run this again.',
    );
  }

  return {
    text: git('show', `${refs.upstream}:${PROVIDER}`),
    fullCopy,
    unregistered,
  };
}

function register(
  providerText: string,
  entry: JournalEntry,
  fullCopy: boolean,
): { text: string; key: string } {
  const existing = [...providerText.matchAll(/\bmigration(\d+):/g)].map((m) =>
    Number(m[1]),
  );
  const maxExisting = Math.max(0, ...existing);

  // Kysely runs migrations in key order, so the new key must sort last.
  const seconds = Math.max(Math.floor(entry.when / 1000), maxExisting + 1);
  const key = `migration${seconds}`;

  const endIdx = providerText.indexOf(REGISTRY_END);
  if (endIdx === -1) {
    return fail(`could not find the migration registry end in ${PROVIDER}`);
  }
  const lineStart = providerText.lastIndexOf('\n', endIdx) + 1;

  const lines = [
    `        ${key}: makeMigrationFromSqlFile(`,
    `          './sql/${entry.tag}.sql',`,
    ...(fullCopy ? ['          true,'] : []),
    `        ),`,
  ];

  return {
    text:
      providerText.slice(0, lineStart) +
      lines.join('\n') +
      '\n' +
      providerText.slice(lineStart),
    key,
  };
}

function main() {
  const refs = detectRefs();

  const unresolvedSchema = git('diff', '--name-only', '--diff-filter=U')
    .split('\n')
    .filter((f) => f.startsWith(SCHEMA_DIR));
  if (unresolvedSchema.length > 0) {
    fail(
      `resolve schema conflicts first, since the migration is generated from them:\n  ${unresolvedSchema.join('\n  ')}`,
    );
  }

  const upstream = readJournalAt(refs.upstream);
  const ours = readJournalAt(refs.ours);
  const upstreamTags = new Set(upstream.entries.map((e) => e.tag));
  const ourTags = new Set(ours.entries.map((e) => e.tag));
  const ourOnly = ours.entries.filter((e) => !upstreamTags.has(e.tag));
  const upstreamOnly = upstream.entries.filter((e) => !ourTags.has(e.tag));

  if (ourOnly.length === 0 || upstreamOnly.length === 0) {
    console.log('No diverging migrations, so nothing to resolve.');
    return;
  }

  const lastUpstream = upstream.entries.at(-1);
  if (lastUpstream === undefined) {
    return fail('upstream journal has no entries');
  }

  const provider = planProvider(refs, ourOnly);

  console.log(`Resolving migrations for ${refs.kind}.`);
  console.log(`  upstream: ${upstreamOnly.map((e) => e.tag).join(', ')}`);
  console.log(`  removing: ${ourOnly.map((e) => e.tag).join(', ')}`);

  for (const e of ourOnly) {
    for (const file of [`${SQL_DIR}/${e.tag}.sql`, snapshotPath(e.idx)]) {
      git('rm', '-q', '-f', '--ignore-unmatch', '--', file);
      fs.rmSync(abs(file), { force: true });
    }
  }

  // Our files are gone, so checking out the directory yields upstream's exact state.
  git('checkout', refs.upstream, '--', SQL_DIR);

  console.log('\nRunning drizzle-kit generate...\n');
  const gen = spawnSync('pnpm', ['drizzle-kit', 'generate'], {
    cwd: abs('server'),
    stdio: 'inherit',
  });
  if (gen.status !== 0) {
    fail(
      'drizzle-kit generate failed. Upstream migrations are in place, so fix the error and run this again.',
    );
  }

  let providerText = provider.text;
  for (const e of ourOnly) {
    providerText = providerText.replace(entryRegex(e.tag), '');
  }

  const generated = readJson<Journal>(JOURNAL).entries.filter(
    (e) => !upstreamTags.has(e.tag),
  );

  if (generated.length === 0) {
    fs.writeFileSync(abs(PROVIDER), providerText);
    git('add', '--', SQL_DIR, PROVIDER);
    console.log(
      '\ndrizzle-kit found no schema changes beyond upstream, so no migration was generated.',
    );
    return;
  }

  const [entry, ...extra] = generated;
  if (entry === undefined || extra.length > 0) {
    return fail(
      `expected one generated migration, found ${generated.length}: ${generated.map((e) => e.tag).join(', ')}`,
    );
  }

  const newSnapshot = readJson<Snapshot>(snapshotPath(entry.idx));
  const upstreamSnapshot = readJson<Snapshot>(snapshotPath(lastUpstream.idx));
  if (newSnapshot.prevId !== upstreamSnapshot.id) {
    fail(
      `snapshot chain is broken: ${snapshotPath(entry.idx)} prevId ${newSnapshot.prevId} does not match ${upstreamSnapshot.id}`,
    );
  }

  const { text, key } = register(providerText, entry, provider.fullCopy);
  fs.writeFileSync(abs(PROVIDER), text);
  git('add', '--', SQL_DIR, PROVIDER);

  console.log(`\nGenerated ${SQL_DIR}/${entry.tag}.sql`);
  console.log(
    `Registered as ${key}${provider.fullCopy ? ' (fullCopy: true, carried over)' : ''}`,
  );
  if (provider.unregistered.length > 0) {
    console.log(
      `Note: ${provider.unregistered.map((e) => e.tag).join(', ')} had no registry entry on this branch.`,
    );
  }
  console.log('Staged the migration directory and provider.');
  console.log('\nNext:');
  console.log('  1. Review the generated SQL for destructive statements.');
  console.log(
    '  2. Reset your dev DB if it already ran the old branch migration.',
  );
  console.log(`  3. Run git ${refs.kind} --continue.`);
}

main();
