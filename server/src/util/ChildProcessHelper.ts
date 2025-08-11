import { fileExists } from '@/util/fsUtil.js';
import { isNonEmptyString } from '@/util/index.js';
import { sanitizeForExec } from '@/util/strings.js';
import { isEmpty } from 'lodash-es';
import type { ExecOptions } from 'node:child_process';
import { execFile } from 'node:child_process';
import PQueue from 'p-queue';
import { LoggerFactory } from './logging/LoggerFactory.ts';

export class ChildProcessHelper {
  private static execQueue = new PQueue({ concurrency: 3 });
  private logger = LoggerFactory.child({ className: ChildProcessHelper.name });

  getStdout(
    executable: string,
    args: string[],
    swallowError: boolean = false,
    env?: NodeJS.ProcessEnv,
    isPath: boolean = true,
  ): Promise<string> {
    return ChildProcessHelper.execQueue.add(
      async () => {
        const sanitizedPath = sanitizeForExec(executable);
        if (isPath && !(await fileExists(sanitizedPath))) {
          throw new Error(`Path at ${sanitizedPath} does not exist`);
        }

        const opts: ExecOptions = {};
        if (!isEmpty(env)) {
          opts.env = env;
        }

        this.logger.debug(
          `Executing child process: "${sanitizedPath}" ${args.join(' ')}`,
        );

        return await new Promise((resolve, reject) => {
          execFile(sanitizedPath, args, opts, function (error, stdout, stderr) {
            if (error !== null && !swallowError) {
              // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
              reject(error);
            }
            resolve(isNonEmptyString(stdout) ? stdout : stderr);
          });
        });
      },
      { throwOnTimeout: true },
    );
  }
}
