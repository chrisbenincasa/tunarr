import { fileExists } from '@/util/fsUtil.ts';
import { isNonEmptyString } from '@/util/index.ts';
import { sanitizeForExec } from '@/util/strings.ts';
import { isEmpty } from 'lodash-es';
import { ExecOptions, exec } from 'node:child_process';
import PQueue from 'p-queue';

export class ChildProcessHelper {
  private static execQueue = new PQueue({ concurrency: 3 });

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

        return await new Promise((resolve, reject) => {
          exec(
            `"${sanitizedPath}" ${args.join(' ')}`,
            opts,
            function (error, stdout, stderr) {
              if (error !== null && !swallowError) {
                reject(error);
              }
              resolve(isNonEmptyString(stdout) ? stdout : stderr);
            },
          );
        });
      },
      { throwOnTimeout: true },
    );
  }
}
