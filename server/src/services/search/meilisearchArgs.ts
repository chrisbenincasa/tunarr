export type MeilisearchArgsOptions = {
  port: number;
  dbPath: string;
  snapshotDir: string;
  snapshotIntervalSeconds: number;
  // Restore this snapshot on startup. Only set when the index directory is missing.
  importSnapshotPath?: string;
  maxIndexingMemory?: string;
  maxIndexingThreads?: number;
  reduceIndexingMemoryUsage?: boolean;
};

/**
 * Builds the command line for the bundled Meilisearch binary.
 *
 * Meilisearch rejects unknown flags and exits, so a flag renamed by an engine
 * upgrade takes search down. meilisearchArgs.test.ts runs these arguments
 * against the pinned binary to catch that.
 */
export function buildMeilisearchArgs(opts: MeilisearchArgsOptions): string[] {
  const args = [
    '--http-addr',
    `localhost:${opts.port}`,
    '--db-path',
    opts.dbPath,
    '--no-analytics',

    // Upgrade an index written by an older engine in place.
    '--upgrade-db',
  ];

  if (opts.importSnapshotPath) {
    args.push('--import-snapshot', opts.importSnapshotPath);
  }

  if (opts.maxIndexingMemory) {
    args.push('--max-indexing-memory', opts.maxIndexingMemory);
  }

  if (opts.maxIndexingThreads) {
    args.push('--max-indexing-threads', opts.maxIndexingThreads.toString());
  }

  args.push(
    '--schedule-snapshot',
    opts.snapshotIntervalSeconds.toFixed(0),
    '--snapshot-dir',
    opts.snapshotDir,
  );

  if (opts.reduceIndexingMemoryUsage) {
    args.push('--experimental-reduce-indexing-memory-usage');
  }

  return args;
}
