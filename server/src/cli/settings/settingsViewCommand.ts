import { at, isArray, isEmpty } from 'lodash-es';
import { CommandModule } from 'yargs';
import { getSettings } from '../../dao/settings';

type SettingsViewCommandArgs = {
  pretty: boolean;
  path?: string[];
};

export const SettingsViewCommand: CommandModule<
  SettingsViewCommandArgs,
  SettingsViewCommandArgs
> = {
  command: 'view',
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
    const settings = getSettings();
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
