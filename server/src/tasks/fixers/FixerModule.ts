import { BackfillProgramExternalIds } from '@/tasks/fixers/BackfillProgramExternalIds.js';
import { EnsureTranscodeConfigIds } from '@/tasks/fixers/EnsureTranscodeConfigIds.js';
import { AddPlexServerIdsFixer } from '@/tasks/fixers/addPlexServerIds.js';
import { BackfillProgramGroupings } from '@/tasks/fixers/backfillProgramGroupings.js';
import type Fixer from '@/tasks/fixers/fixer.js';
import { MissingSeasonNumbersFixer } from '@/tasks/fixers/missingSeasonNumbersFixer.js';
import { KEYS } from '@/types/inject.js';
import { ContainerModule } from 'inversify';

const FixerModule = new ContainerModule((bind) => {
  bind<Fixer>(KEYS.Fixer).to(BackfillProgramExternalIds);
  bind<Fixer>(KEYS.Fixer).to(EnsureTranscodeConfigIds);
  bind<Fixer>(KEYS.Fixer).to(AddPlexServerIdsFixer);
  bind<Fixer>(KEYS.Fixer).to(BackfillProgramGroupings);
  bind<Fixer>(KEYS.Fixer).to(MissingSeasonNumbersFixer);
});

export { FixerModule };
