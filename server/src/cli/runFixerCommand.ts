import { FixersByName } from '@/tasks/fixers/index.ts';
import { isNonEmptyString } from '@/util/index.ts';
import { keys } from 'lodash-es';
import { CommandModule } from 'yargs';
import { GlobalArgsType } from './types.ts';

type RunFixerCommandArgs = {
  fixer: keyof typeof FixersByName;
};

export const RunFixerCommand: CommandModule<
  GlobalArgsType,
  GlobalArgsType & RunFixerCommandArgs
> = {
  command: 'fixer [fixer]',
  describe: 'Run a specific fixer task',
  builder: (yargs) =>
    yargs.positional('fixer', {
      type: 'string',
      choices: keys(FixersByName),
      demandOption: true,
    }),
  handler: async (argv) => {
    if (isNonEmptyString(argv.fixer)) {
      try {
        await FixersByName[argv.fixer].run();
      } catch (e) {
        console.error('Fixer failed', e);
        throw e;
      }
    } else {
      console.error('Specify a fixer to run');
      process.exit(1);
    }
  },
};
