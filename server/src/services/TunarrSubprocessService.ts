import { injectable } from 'inversify';
import { pathToFileURL } from 'node:url';
import { Worker, type WorkerOptions } from 'node:worker_threads';
import { container } from '../container.ts';
import { globalOptions, serverOptions } from '../globals.ts';
import { isDev } from '../util/index.ts';
import { MeilisearchService } from './MeilisearchService.ts';

@injectable()
export class TunarrSubprocessService {
  constructor() {}

  createWorker(opts: WorkerOptions = {}) {
    return new TsWorker(process.argv[1]!, {
      ...opts,
      argv: workerArgv(),
    });
  }
}

/**
 * Builds the argv a worker is started with.
 *
 * The global options must be passed as real flags, not only through
 * `workerData`. A worker re-executes the CLI entry point, and its yargs
 * middleware calls `setGlobalOptions` — which is `once()`-guarded — before any
 * command handler runs. Whatever the middleware resolves is therefore final. If
 * the database directory is not on the worker's argv, yargs falls back to its
 * default (`TUNARR_DATABASE_PATH` or the platform default) and the worker
 * opens, migrates and writes to a completely different database than the server
 * that spawned it.
 */
function workerArgv(): string[] {
  const opts = globalOptions();
  return [
    '--hide_banner',
    'start-worker',
    '--database',
    opts.databaseDirectory,
    '--log_level',
    opts.log_level,
  ];
}

/**
 * Converts the entry script path into a URL a Worker will accept.
 *
 * Must not be `new URL(entryPath, import.meta.url)`. `process.argv[1]` is a
 * filesystem path, not a URL, and on Windows an absolute one begins with a
 * drive letter: `new URL('C:\\Tunarr\\bundle.cjs', base)` parses `C:` as the
 * scheme and yields a `c:` URL rather than resolving against the base at all.
 * Worker rejects that, so the packaged Windows build could never spawn a
 * worker. `pathToFileURL` does the platform-correct conversion.
 */
export function workerEntryUrl(entryPath: string): URL {
  return pathToFileURL(entryPath);
}

class TsWorker extends Worker {
  constructor(filename: string, options: WorkerOptions = {}) {
    options.workerData ??= {
      serverOptions: {
        ...serverOptions(),
        searchPort: container
          .get<MeilisearchService>(MeilisearchService)
          .getPort(),
      },
    };

    if (isDev) {
      super(
        `import('tsx/esm/api').then(({ register }) => { register(); import('${workerEntryUrl(filename).href}') })`,
        {
          ...options,
          eval: true,
        },
      );
    } else {
      super(workerEntryUrl(filename), options);
    }
  }
}
