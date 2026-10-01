import { KEYS } from '@/types/inject.js';
import { tag } from '@tunarr/types';
import { and, eq, gt, inArray, isNotNull } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { chunk } from 'lodash-es';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { MediaSourceId } from '../../db/schema/base.ts';
import type { DrizzleDBAccess } from '../../db/schema/index.ts';
import { Program } from '../../db/schema/Program.ts';
import { ProgramMediaStream } from '../../db/schema/ProgramMediaStream.ts';
import { ProgramSubtitles } from '../../db/schema/ProgramSubtitles.ts';
import { ProgramVersion } from '../../db/schema/ProgramVersion.ts';
import { FileSystemService } from '../../services/FileSystemService.ts';
import { fileExists } from '../../util/fsUtil.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import { getSubtitleCacheFilePath } from '../../util/subtitles.ts';
import throttle from '../../util/throttle.ts';
import Fixer from './fixer.ts';

// Written once the sweep finishes, so later starts skip it with one stat.
export const SubtitleCacheSweepMarker = '.orphan-sweep-v1';

const SELECT_BATCH_SIZE = 1_000;

const FILES_PER_YIELD = 500;

// A scan may have just downloaded a file whose row is not committed yet.
const MIN_FILE_AGE_MS = 60 * 60 * 1000;

type HashInputs = {
  programId: string;
  externalKey: string;
  mediaSourceId: string | null;
  sourceType: (typeof Program.$inferSelect)['sourceType'];
  streamIndex: number | null;
  codec: string;
};

/**
 * Deletes files in the subtitle cache that nothing references: sidecar copies
 * left behind by rescans, and files for programs that no longer exist.
 *
 * A file is kept if a subtitle row stores its path, or if its name matches the
 * one playback and extraction compute for an embedded subtitle stream.
 */
@injectable()
export class SweepOrphanedSubtitleCacheFixer extends Fixer {
  canRunInBackground = true;

  @InjectLogger() declare protected readonly logger: Logger;

  constructor(
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
    @inject(FileSystemService) private fileSystemService: FileSystemService,
  ) {
    super();
  }

  protected async runInternal(): Promise<void> {
    const cacheFolder = path.resolve(
      this.fileSystemService.getSubtitleCacheFolder(),
    );
    const marker = path.join(cacheFolder, SubtitleCacheSweepMarker);

    if (!(await fileExists(cacheFolder)) || (await fileExists(marker))) {
      return;
    }

    const keep = await this.buildKeepSet(cacheFolder);
    const candidates = await this.findUnreferencedFiles(cacheFolder, keep);
    const removed = await this.removeUnlessReferenced(candidates);

    await fs.writeFile(marker, new Date().toISOString());

    this.logger.info(
      'Removed %d orphaned files from the subtitle cache',
      removed,
    );
  }

  // Keys are paths relative to the cache folder, which keeps the set small.
  private async buildKeepSet(cacheFolder: string): Promise<Set<string>> {
    const keep = new Set<string>();
    const addAbsolute = (filePath: string) => {
      const relative = path.relative(cacheFolder, path.resolve(filePath));
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
        keep.add(relative);
      }
    };
    const addHashed = (inputs: HashInputs) => {
      if (inputs.mediaSourceId === null) {
        return;
      }

      const relative = getSubtitleCacheFilePath(
        {
          id: inputs.programId,
          externalKey: inputs.externalKey,
          externalSourceId: tag<MediaSourceId>(inputs.mediaSourceId),
          externalSourceType: inputs.sourceType,
        },
        {
          streamIndex: inputs.streamIndex ?? undefined,
          codec: inputs.codec,
        },
      );
      if (relative) {
        keep.add(relative);
      }
    };

    let cursor: string | undefined;
    for (;;) {
      const batch = this.drizzleDB
        .select({
          uuid: ProgramSubtitles.uuid,
          path: ProgramSubtitles.path,
          subtitleType: ProgramSubtitles.subtitleType,
          streamIndex: ProgramSubtitles.streamIndex,
          codec: ProgramSubtitles.codec,
          programId: Program.uuid,
          externalKey: Program.externalKey,
          mediaSourceId: Program.mediaSourceId,
          sourceType: Program.sourceType,
        })
        .from(ProgramSubtitles)
        .innerJoin(Program, eq(Program.uuid, ProgramSubtitles.programId))
        .where(
          cursor === undefined ? undefined : gt(ProgramSubtitles.uuid, cursor),
        )
        .orderBy(ProgramSubtitles.uuid)
        .limit(SELECT_BATCH_SIZE)
        .all();

      for (const row of batch) {
        if (row.path) {
          addAbsolute(row.path);
        }
        if (row.subtitleType === 'embedded') {
          addHashed(row);
        }
      }

      const last = batch.at(-1);
      if (!last || batch.length < SELECT_BATCH_SIZE) {
        break;
      }
      cursor = last.uuid;
      await throttle();
    }

    // Playback and extraction name embedded files from the media streams, so
    // those are covered even where a subtitle row is missing or differs.
    cursor = undefined;
    for (;;) {
      const batch = this.drizzleDB
        .select({
          uuid: ProgramMediaStream.uuid,
          streamIndex: ProgramMediaStream.index,
          codec: ProgramMediaStream.codec,
          programId: Program.uuid,
          externalKey: Program.externalKey,
          mediaSourceId: Program.mediaSourceId,
          sourceType: Program.sourceType,
        })
        .from(ProgramMediaStream)
        .innerJoin(
          ProgramVersion,
          eq(ProgramVersion.uuid, ProgramMediaStream.programVersionId),
        )
        .innerJoin(Program, eq(Program.uuid, ProgramVersion.programId))
        .where(
          and(
            eq(ProgramMediaStream.streamKind, 'subtitles'),
            cursor === undefined
              ? undefined
              : gt(ProgramMediaStream.uuid, cursor),
          ),
        )
        .orderBy(ProgramMediaStream.uuid)
        .limit(SELECT_BATCH_SIZE)
        .all();

      for (const row of batch) {
        addHashed(row);
      }

      const last = batch.at(-1);
      if (!last || batch.length < SELECT_BATCH_SIZE) {
        break;
      }
      cursor = last.uuid;
      await throttle();
    }

    return keep;
  }

  // Cache files sit two directories deep. Anything else is left alone.
  private async findUnreferencedFiles(
    cacheFolder: string,
    keep: Set<string>,
  ): Promise<string[]> {
    const cutoff = Date.now() - MIN_FILE_AGE_MS;
    const candidates: string[] = [];
    let seen = 0;

    for (const outer of await readDirs(cacheFolder)) {
      for (const inner of await readDirs(path.join(cacheFolder, outer))) {
        const dir = path.join(cacheFolder, outer, inner);
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) {
            continue;
          }

          if (++seen % FILES_PER_YIELD === 0) {
            await throttle();
          }

          if (keep.has(path.join(outer, inner, entry.name))) {
            continue;
          }

          const fullPath = path.join(dir, entry.name);
          const stat = await fs.stat(fullPath).catch(() => undefined);
          if (stat && stat.mtimeMs < cutoff) {
            candidates.push(fullPath);
          }
        }
      }
    }

    return candidates;
  }

  // Rows written since the keep set was built can point at an old file, for
  // example when extraction tops up a sidecar that was already cached.
  private async removeUnlessReferenced(candidates: string[]) {
    let removed = 0;
    for (const paths of chunk(candidates, SELECT_BATCH_SIZE)) {
      const referenced = new Set(
        this.drizzleDB
          .select({ path: ProgramSubtitles.path })
          .from(ProgramSubtitles)
          .where(
            and(
              isNotNull(ProgramSubtitles.path),
              inArray(ProgramSubtitles.path, paths),
            ),
          )
          .all()
          .map((row) => row.path),
      );

      for (const filePath of paths) {
        if (referenced.has(filePath)) {
          continue;
        }
        try {
          await fs.rm(filePath, { force: true });
          removed++;
        } catch (e) {
          this.logger.warn(e, 'Unable to remove cached subtitle %s', filePath);
        }
      }

      await throttle();
    }
    return removed;
  }
}

async function readDirs(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((e) => e.name);
}
