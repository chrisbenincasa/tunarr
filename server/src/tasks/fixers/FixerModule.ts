import { EnsureTranscodeConfigIds } from '@/tasks/fixers/EnsureTranscodeConfigIds.js';
import type Fixer from '@/tasks/fixers/fixer.js';
import { KEYS } from '@/types/inject.js';
import { ContainerModule } from 'inversify';
import { BackfillMediaSourceIdFixer } from './BackfillMediaSourceIdFixer.ts';
import { FixSmartCollectionFilters } from './FixSmartCollectionFIlters.ts';

const FixerModule = new ContainerModule((bind) => {
  bind<Fixer>(KEYS.Fixer).to(EnsureTranscodeConfigIds);
  bind<Fixer>(KEYS.Fixer).to(BackfillMediaSourceIdFixer);
  bind<Fixer>(KEYS.Fixer).to(FixSmartCollectionFilters);
});

export { FixerModule };
