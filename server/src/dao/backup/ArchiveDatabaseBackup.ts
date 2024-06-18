import { FileBackupOutput } from '@tunarr/types/schemas';
import archiver from 'archiver';
import dayjs from 'dayjs';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LoggerFactory } from '../../util/logging/LoggerFactory';
import { SettingsDB } from '../settings';
import { BackupResult, DatabaseBackup } from './DatabaseBackup';
import { SqliteDatabaseBackup } from './SqliteDatabaseBackup';
import { compact, isEmpty, isNull, map, sortBy, take } from 'lodash-es';
import { asyncPool } from '../../util/asyncPool';
import { fileExists } from '../../util/fsUtil.js';
import { isDocker } from '../../util/isDocker.js';
import { getDatabasePath } from '../databaseDirectoryUtil';

export class ArchiveDatabaseBackup extends DatabaseBackup<string> {
  #logger = LoggerFactory.child({ className: ArchiveDatabaseBackup.name });
  #config: FileBackupOutput;
  #normalizedOutputPath: string;

  constructor(settings: SettingsDB, config: FileBackupOutput) {
    super(settings);
    this.#config = config;
    if (isEmpty(config.outputPath) && isDocker()) {
      this.#normalizedOutputPath = '/config/tunarr/backups';
    } else {
      this.#normalizedOutputPath = path.resolve(
        process.cwd(),
        this.#config.outputPath,
      );
    }
  }

  async backup(): Promise<BackupResult<string>> {
    const workingDirectory = path.join(
      path.resolve(this.#config.tempDir ?? os.tmpdir()),
      `tunarr-backup-`,
    );

    let tempDir: string;
    try {
      tempDir = await fs.mkdtemp(workingDirectory);
      this.#logger.debug('Working on new backup at %s', tempDir);
    } catch (e) {
      this.#logger.error(
        e,
        'Error creating temp directory at %s',
        workingDirectory,
      );
      // TODO Return a status??
      throw e;
    }

    const isGzip = !!this.#config.gzip && this.#config.archiveFormat === 'tar';

    if (!(await fileExists(this.#normalizedOutputPath))) {
      this.#logger.debug(
        'Backup path at %s does not exist. Creating it now.',
        this.#normalizedOutputPath,
      );
      await fs.mkdir(this.#normalizedOutputPath, { recursive: true });
    }

    const backupFileName = path.join(
      this.#normalizedOutputPath,
      `tunarr-backup-${dayjs().format('YYYYMMDD_HHmmss')}.${
        this.#config.archiveFormat
      }${isGzip ? '.gz' : ''}`,
    );

    this.#logger.info(`Writing backup to ${backupFileName}`);

    const outStream = createWriteStream(backupFileName);
    const archive = archiver(this.#config.archiveFormat, { gzip: isGzip });
    const finishedPromise = new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve(void 0));
      archive.on('error', reject);
      archive.on('entry', (entry) => {
        this.#logger.debug('Added entry to backup: %s', entry.name);
      });
    });

    archive.pipe(outStream);

    const sqlBackup = new SqliteDatabaseBackup();
    const sqlBackupFile = await sqlBackup.backup(path.join(tempDir, 'db.db'));

    archive
      .file(sqlBackupFile, { name: 'db.db' })
      .file(getDatabasePath('settings.json'), { name: 'settings.json' })
      .directory(getDatabasePath('channel-lineups'), 'channel-lineups')
      .directory(getDatabasePath('images'), 'images')
      .directory(getDatabasePath('cache'), 'cache')
      .glob('*.xml', { cwd: getDatabasePath('') });
    await archive.finalize();

    this.#logger.trace('Finalized archive stream %s', backupFileName);

    await fs.rm(tempDir, { recursive: true });

    this.#logger.trace('Deleted temp backup directory');

    await this.deleteOldBackupIfNecessary();

    return finishedPromise
      .then(() => ({ type: 'success' as const, data: backupFileName }))
      .catch((e) => {
        this.#logger.error(e, 'Error creating backup');
        return { type: 'error' };
      });
  }

  private async deleteOldBackupIfNecessary() {
    if (this.#config.maxBackups <= 0) {
      return;
    }

    const listings = await fs.readdir(this.#normalizedOutputPath);
    const relevantListings = sortBy(
      compact(
        map(listings, (file) => {
          const matchArr = file.match(/tunarr-backup-(\d{8}_\d{6})/);
          if (isNull(matchArr) || matchArr.length === 0) {
            return;
          }

          const [date, time] = matchArr[1].split('_', 2);
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

    if (relevantListings.length > this.#config.maxBackups) {
      this.#logger.debug(
        'Found %d old backups. The limit is %d',
        relevantListings.length,
        this.#config.maxBackups,
      );
      const listingsToDelete = take(
        relevantListings,
        relevantListings.length - this.#config.maxBackups,
      );

      for await (const result of asyncPool(
        listingsToDelete,
        async ([file]) => fs.rm(path.join(this.#normalizedOutputPath, file)),
        { concurrency: 3 },
      )) {
        if (result.type === 'error') {
          this.#logger.warn(
            'Unable to delete old backup file: %s',
            result.input,
          );
        } else {
          this.#logger.debug(
            'Successfully deleted old backup file %s',
            result.input[0],
          );
        }
      }
    }
  }
}
