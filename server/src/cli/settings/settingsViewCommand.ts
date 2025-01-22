import { at, isArray, isEmpty } from 'lodash-es';
import type { CommandModule } from 'yargs';
import { container } from '../../container.ts';
import type { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import { KEYS } from '../../types/inject.ts';

type SettingsViewCommandArgs = {
  pretty: boolean;
  path?: string[];
};

export const SettingsViewCommand: CommandModule<
  SettingsViewCommandArgs,
  SettingsViewCommandArgs
> = {
  command: 'view',
  describe: 'View tunarr settings.',
  builder: (yargs) =>
    yargs
      .option('pretty', {
        type: 'boolean',
        default: false,
        desc: 'Print settings JSON with spacing',
      })
      .option('path', {
        type: 'string',
        array: true,
        desc: 'Filter settings JSON down to one or more paths in JSON path syntax (e.g. settings.ffmpeg.ffmpegExecutablePath)',
      }),
  // eslint-disable-next-line @typescript-eslint/require-await
  handler: async (args) => {
    const settings = container.get<ISettingsDB>(KEYS.SettingsDB);
    let viewSettings: unknown;
    if (!isEmpty(args.path)) {
      viewSettings = at(settings.getAll(), args.path ?? []);
    } else {
      viewSettings = settings.getAll();
    }

    if (isArray(viewSettings) && !isEmpty(viewSettings)) {
      viewSettings = viewSettings[0];
    }

    console.log(
      JSON.stringify(viewSettings, null, args.pretty ? 4 : undefined),
    );
  },
};
