import { Tag } from '@tunarr/types';
import { Schedule } from '@tunarr/types/schemas';
import {
  forEach,
  isError,
  isNull,
  isUndefined,
  map,
  nth,
  uniq,
} from 'lodash-es';
import fs from 'node:fs';
import path from 'node:path';
import SonicBoom, { SonicBoomOpts } from 'sonic-boom';
import { attemptSync, isDefined } from '..';
import { ScheduledTask } from '../../tasks/ScheduledTask';
import { Task, TaskId } from '../../tasks/Task';
import { Maybe } from '../../types/util';
import { scheduleRuleToCronString } from '../schedulingUtil';

type Opts = {
  fileName: string;
  fileExt?: string;
  maxSizeBytes?: number;
  rotateSchedule?: Schedule;
  extension?: string;
  destinationOpts?: SonicBoomOpts;
  fileLimit?: {
    count?: number;
  };
};

export class RollingLogDestination {
  private initialized = false;
  private scheduledTask: Maybe<ScheduledTask>;
  private destination: SonicBoom;
  private currentFileName: string;
  private createdFileNames: string[] = [];
  private rotatePattern: RegExp;

  constructor(private opts: Opts) {
    this.rotatePattern = new RegExp(`(\\d+)${this.opts.extension ?? ''}$`);
    this.initState();
  }

  initDestination() {
    if (this.initialized || this.destination) {
      return this.destination;
    }

    if (this.opts.rotateSchedule) {
      let schedule: string;
      switch (this.opts.rotateSchedule.type) {
        case 'cron':
          schedule = this.opts.rotateSchedule.cron;
          break;
        case 'every':
          schedule = scheduleRuleToCronString(this.opts.rotateSchedule);
          break;
      }

      this.scheduledTask = new ScheduledTask(
        'RotateLogs',
        schedule,
        () => new RollLogFileTask(this),
      );
    }

    this.destination = new SonicBoom({
      ...(this.opts.destinationOpts ?? {}),
      dest: this.opts.fileName,
    });

    if (this.opts.maxSizeBytes && this.opts.maxSizeBytes > 0) {
      let currentSize = getFileSize(this.currentFileName);
      this.destination.on('write', (size) => {
        currentSize += size;
        if (
          isDefined(this.opts.maxSizeBytes) &&
          this.opts.maxSizeBytes > 0 &&
          currentSize >= this.opts.maxSizeBytes
        ) {
          currentSize = 0;
          // Make sure the log flushes before we roll
          setTimeout(() => {
            const rollResult = attemptSync(() => this.roll());
            if (isError(rollResult)) {
              console.error('Error while rolling log files', rollResult);
            }
          }, 0);
        }
      });
    }

    if (this.scheduledTask) {
      this.destination.on('close', () => {
        this.scheduledTask?.cancel();
      });
    }

    return this.destination;
  }

  roll() {
    if (!this.destination) {
      return;
    }

    this.destination.flushSync();

    const tmpFile = `${this.opts.fileName}.tmp`;
    fs.copyFileSync(this.opts.fileName, tmpFile);
    fs.truncateSync(this.opts.fileName);

    const numFiles = this.createdFileNames.length;
    const dirname = path.dirname(this.opts.fileName);
    const addedFiles: string[] = [];
    for (let i = numFiles; i > 0; i--) {
      const f = nth(this.createdFileNames, i - 1);
      if (isUndefined(f)) {
        continue;
      }
      const rotateMatches = f.match(this.rotatePattern);
      // This really shouldn't happen since the file shouldn't
      // make it into the array in the first place if it doesn't
      // match..
      if (isNull(rotateMatches)) {
        continue;
      }

      const rotateNum = parseInt(rotateMatches[1]);

      // Again shouldn't happen since we've already matched
      // that this part of the file is a number...
      if (isNaN(rotateNum)) {
        continue;
      }

      const nextNum = rotateNum + 1;
      const nextFile = f.replace(this.rotatePattern, `${nextNum}`);

      const result = attemptSync(() =>
        fs.renameSync(path.join(dirname, f), path.join(dirname, nextFile)),
      );

      if (isError(result)) {
        console.warn(`Error rotating ${path.join(dirname, f)}`);
      }

      addedFiles.push(nextFile);
    }

    const nextFile = this.buildFileName(1);
    fs.renameSync(tmpFile, nextFile);

    this.createdFileNames = uniq([
      path.basename(nextFile),
      ...this.createdFileNames,
      ...addedFiles.slice(0, 1),
    ]);

    if (this.opts.fileLimit) {
      this.checkFileRemoval();
    }
  }

  private initState() {
    for (const file of fs.readdirSync(path.dirname(this.opts.fileName))) {
      if (file.match(this.rotatePattern)) {
        this.createdFileNames.push(file);
      }
    }
  }

  private checkFileRemoval() {
    const count = this.opts.fileLimit?.count;

    if (count && count >= 1 && this.createdFileNames.length > count) {
      // We start removing at the first file to delete and take the rest of the
      // array. In general this will be just one file.
      const filesToRemove = this.createdFileNames.splice(count);
      forEach(
        map(filesToRemove, (file) =>
          path.join(path.dirname(this.opts.fileName), file),
        ),
        (file) => {
          const res = attemptSync(() => fs.unlinkSync(file));
          if (isError(res)) {
            console.warn(`Error while deleting log file ${file}`, res);
          }
        },
      );
    }
    return;
  }

  private buildFileName(num: number) {
    return `${this.opts.fileName}.${num}${this.opts.fileExt ?? ''}`;
  }
}

class RollLogFileTask extends Task {
  public ID: string | Tag<TaskId, unknown>;

  constructor(private dest: RollingLogDestination) {
    super();
  }

  protected runInternal(): Promise<unknown> {
    return Promise.resolve(this.dest.roll());
  }
}

function getFileSize(path: string) {
  const result = attemptSync(() => fs.statSync(path));

  return isError(result) ? 0 : result.size;
}
