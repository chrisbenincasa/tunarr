import { asyncPool } from '@/util/asyncPool.js';
import { getDatabasePath } from '@/util/databaseDirectoryUtil.js';
import { fileExists } from '@/util/fsUtil.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import type { FileBackupOutput } from '@tunarr/types/schemas';
import archiver from 'archiver';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { compact, isEmpty, isNull, map, sortBy, take } from 'lodash-es';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { dbOptions, GlobalOptions } from '../../globals.ts';
import { FileSystemService } from '../../services/FileSystemService.ts';
import { MeilisearchService } from '../../services/MeilisearchService.ts';
import { KEYS } from '../../types/inject.ts';
import {
  CacheFolderName,
  ChannelLineupsFolderName,
  ImagesFolderName,
  SearchSnapshotsFolderName,
  SettingsJsonFilename,
} from '../../util/constants.ts';
import {
  DISABLE_SEARCH_SNAPSHOT_IN_BACKUP,
  getBooleanEnvVar,
} from '../../util/env.ts';
import { run } from '../../util/index.ts';
import { ISettingsDB } from '../interfaces/ISettingsDB.ts';
import type { BackupResult } from './DatabaseBackup.ts';
import { DatabaseBackup } from './DatabaseBackup.ts';
import { SqliteDatabaseBackup } from './SqliteDatabaseBackup.ts';

export type ArchiveDatabaseBackupFactory = () => ArchiveDatabaseBackup;

@injectable()
export class ArchiveDatabaseBackup extends DatabaseBackup<string> {
  logger = LoggerFactory.child({ className: ArchiveDatabaseBackup.name });
  #normalizedOutputPath: string;

  constructor(
    @inject(KEYS.SettingsDB) settings: ISettingsDB,
    @inject(KEYS.GlobalOptions) private globalOptions: GlobalOptions,
    @inject(FileSystemService) private fileSystemService: FileSystemService,
    @inject(MeilisearchService) private searchService: MeilisearchService,
  ) {
    super(settings);
  }

  async backup(config: FileBackupOutput): Promise<BackupResult<string>> {
    if (isEmpty(config.outputPath)) {
      this.#normalizedOutputPath = path.join(
        this.globalOptions.databaseDirectory,
        'backups',
      );
    } else {
      this.#normalizedOutputPath = path.resolve(
        process.cwd(),
        config.outputPath,
      );
    }

    const workingDirectory = path.join(
      path.resolve(config.tempDir ?? os.tmpdir()),
      `tunarr-backup-`,
    );

    let tempDir: string;
    try {
      tempDir = await fs.mkdtemp(workingDirectory);
      this.logger.debug('Working on new backup at %s', tempDir);
    } catch (e) {
      this.logger.error(
        e,
        'Error creating temp directory at %s',
        workingDirectory,
      );
      // TODO Return a status??
      throw e;
    }

    const isGzip = !!config.gzip && config.archiveFormat === 'tar';

    if (!(await fileExists(this.#normalizedOutputPath))) {
      this.logger.debug(
        'Backup path at %s does not exist. Creating it now.',
        this.#normalizedOutputPath,
      );
      await fs.mkdir(this.#normalizedOutputPath, { recursive: true });
    }

    const backupFileName = path.join(
      this.#normalizedOutputPath,
      `tunarr-backup-${dayjs().format('YYYYMMDD_HHmmss')}.${
        config.archiveFormat
      }${isGzip ? '.gz' : ''}`,
    );

    this.logger.info(`Writing backup to ${backupFileName}`);

    const outStream = createWriteStream(backupFileName);
    const archive = archiver(config.archiveFormat, { gzip: isGzip });
    const finishedPromise = new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve(void 0));
      archive.on('error', reject);
      archive.on('entry', (entry) => {
        this.logger.trace('Added entry to backup: %s', entry.name);
      });
    });

    archive.pipe(outStream);

    const sqlBackup = new SqliteDatabaseBackup();
    const sqlBackupFilePromise = sqlBackup.backup(
      dbOptions().dbName,
      // TODO: have a constant for this
      path.join(tempDir, 'db.db'),
    );

    const searchSnapshotPromise = run(async () => {
      if (getBooleanEnvVar(DISABLE_SEARCH_SNAPSHOT_IN_BACKUP, false)) {
        const snapshotTaskId = await this.searchService.createSnapshot();
        return this.searchService.monitorTask(snapshotTaskId);
      } else {
        return Promise.resolve(void 0);
      }
    });

    const [sqlBackupFile] = await Promise.all([
      sqlBackupFilePromise,
      searchSnapshotPromise,
    ]);

    archive
      .file(sqlBackupFile, { name: 'db.db' })
      .file(getDatabasePath(SettingsJsonFilename), {
        name: SettingsJsonFilename,
      })
      .directory(
        getDatabasePath(ChannelLineupsFolderName),
        ChannelLineupsFolderName,
      )
      .directory(getDatabasePath(ImagesFolderName), ImagesFolderName)
      .directory(getDatabasePath(CacheFolderName), CacheFolderName)
      .directory(
        this.fileSystemService.getMsSnapshotsPath(),
        SearchSnapshotsFolderName,
      )
      .glob('*.xml', { cwd: getDatabasePath('') });
    await archive.finalize();

    this.logger.trace('Finalized archive stream %s', backupFileName);

    await fs.rm(tempDir, { recursive: true });

    this.logger.trace('Deleted temp backup directory');

    await this.deleteOldBackupIfNecessary(config);

    return finishedPromise
      .then(() => ({ type: 'success' as const, data: backupFileName }))
      .catch((e) => {
        this.logger.error(e, 'Error creating backup');
        return { type: 'error' };
      });
  }

  private async deleteOldBackupIfNecessary(config: FileBackupOutput) {
    if (config.maxBackups <= 0) {
      return;
    }

    const listings = await fs.readdir(this.#normalizedOutputPath);
    const relevantListings = sortBy(
      compact(
        map(listings, (file) => {
          const matchArr = file.match(/tunarr-backup-(\d{8}_\d{6})/);
          if (isNull(matchArr) || matchArr.length < 2) {
            return;
          }

          const [date, time] = matchArr[1]!.split('_', 2);
          if (!date || !time) {
            return;
          }

          const dateNum = parseInt(date);
          const timeNum = parseInt(time);
          // TODO: Log the bad case here
          if (isNaN(dateNum) || isNaN(timeNum)) {
            return;
          }

          return [file, dateNum + timeNum] as const;
        }),
      ),
      ([, sort]) => sort,
    );

    if (relevantListings.length > config.maxBackups) {
      this.logger.debug(
        'Found %d old backups. The limit is %d',
        relevantListings.length,
        config.maxBackups,
      );
      const listingsToDelete = take(
        relevantListings,
        relevantListings.length - config.maxBackups,
      );

      for await (const result of asyncPool(
        listingsToDelete,
        async ([file]) => fs.rm(path.join(this.#normalizedOutputPath, file)),
        { concurrency: 3 },
      )) {
        if (result.isFailure()) {
          this.logger.warn(
            'Unable to delete old backup file: %O',
            result.error.input,
          );
        } else {
          this.logger.debug(
            'Successfully deleted old backup file %s',
            result.get().input[0],
          );
        }
      }
    }
  }
}

export const ArchiveDatabaseBackupKey = Symbol.for(ArchiveDatabaseBackup.name);
