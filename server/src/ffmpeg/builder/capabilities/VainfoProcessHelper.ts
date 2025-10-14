import type { Nilable } from '../../../types/util.ts';
import { ChildProcessHelper } from '../../../util/ChildProcessHelper.ts';
import { attempt, isNonEmptyString } from '../../../util/index.ts';

export class VainfoProcessHelper {
  async getVainfoOutput(
    display: string,
    vaapiDevice: string,
    vaapiDriver: Nilable<string>,
    swallowError: boolean = false,
  ) {
    return attempt(() =>
      new ChildProcessHelper().getStdout(
        'vainfo',
        ['--display', display, '--device', vaapiDevice, '-a'],
        {
          swallowError,
          env: isNonEmptyString(vaapiDriver)
            ? { LIBVA_DRIVER_NAME: vaapiDriver }
            : undefined,
          isPath: false,
        },
      ),
    );
  }
}
