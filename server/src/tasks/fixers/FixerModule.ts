import { EnsureTranscodeConfigIds } from '@/tasks/fixers/EnsureTranscodeConfigIds.js';
import { AddPlexServerIdsFixer } from '@/tasks/fixers/addPlexServerIds.js';
import type Fixer from '@/tasks/fixers/fixer.js';
import { MissingSeasonNumbersFixer } from '@/tasks/fixers/missingSeasonNumbersFixer.js';
import { KEYS } from '@/types/inject.js';
import { ContainerModule } from 'inversify';
import { BackfillMediaSourceIdFixer } from './BackfillMediaSourceIdFixer.ts';
import { BackfillProgramExternalIds } from './BackfillProgramExternalIds.ts';

const FixerModule = new ContainerModule((bind) => {
  bind<Fixer>(KEYS.Fixer).to(BackfillProgramExternalIds);
  bind<Fixer>(KEYS.Fixer).to(EnsureTranscodeConfigIds);
  bind<Fixer>(KEYS.Fixer).to(AddPlexServerIdsFixer);
  bind<Fixer>(KEYS.Fixer).to(MissingSeasonNumbersFixer);
  bind<Fixer>(KEYS.Fixer).to(BackfillMediaSourceIdFixer);
});

export { FixerModule };
