import { SettingsSchema } from '@/db/SettingsDB.js';
import { merge } from 'lodash-es';
import type { CommandModule } from 'yargs';
import { container } from '../../container.ts';
import type { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import { KEYS } from '../../types/inject.ts';

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
    const settingsDB = container.get<ISettingsDB>(KEYS.SettingsDB);
    const settings = settingsDB.getAll();
    const newSettings = merge({}, settings.settings, args.settings);

    try {
      const validSettings = SettingsSchema.parse(newSettings);
      await settingsDB.directUpdate((prev) => {
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
