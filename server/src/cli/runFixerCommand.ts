import { container } from '@/container.js';
import { BackfillProgramExternalIds } from '@/tasks/fixers/BackfillProgramExternalIds.js';
import { EnsureTranscodeConfigIds } from '@/tasks/fixers/EnsureTranscodeConfigIds.js';
import type Fixer from '@/tasks/fixers/fixer.js';
import { KEYS } from '@/types/inject.js';
import { groupByUniq, isNonEmptyString } from '@/util/index.js';
import type { TupleToUnion } from '@tunarr/types';
import type { CommandModule } from 'yargs';
import type { GlobalArgsType } from './types.ts';

const FixerNames = [
  BackfillProgramExternalIds.name,
  EnsureTranscodeConfigIds.name,
] as const;

type RunFixerCommandArgs = {
  fixer: TupleToUnion<typeof FixerNames>;
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
      choices: FixerNames,
      demandOption: true,
    }),
  handler: async (argv) => {
    if (isNonEmptyString(argv.fixer)) {
      try {
        await groupByUniq(
          container.getAll<Fixer>(KEYS.Fixer),
          (fixer) => fixer.constructor.name,
        )[argv.fixer]?.run();
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
