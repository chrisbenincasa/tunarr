import { merge } from 'lodash-es';
import { CommandModule } from 'yargs';
import { SettingsSchema, getSettings } from '../../dao/settings.ts';

type SettingsUpdateCommandArgs = {
  pretty: boolean;
  settings: unknown;
};

export const SettingsUpdateCommand: CommandModule<
  SettingsUpdateCommandArgs,
  SettingsUpdateCommandArgs
> = {
  command: 'update',
  describe: 'Update Tunarr settings directly.',
  builder: (yargs) =>
    yargs
      .usage('$0 settings update ')
      .option('pretty', {
        type: 'boolean',
        default: false,
        desc: 'Print settings JSON with spacing',
      })
      .option('settings', {
        type: 'string',
      })
      .example([
        [
          '$0 settings update --settings.ffmpeg.ffmpegExecutablePath="/usr/bin/ffmpeg"',
          'Update FFmpeg executable path',
        ],
      ]),
  handler: async (args) => {
    const settings = getSettings().getAll();
    const newSettings = merge({}, settings.settings, args.settings);

    try {
      const validSettings = SettingsSchema.parse(newSettings);
      await getSettings().directUpdate((prev) => {
        prev.settings = validSettings;
      });

      console.log(
        JSON.stringify(validSettings, undefined, args.pretty ? 4 : undefined),
      );
    } catch (e) {
      console.error(e);
    }
  },
};
