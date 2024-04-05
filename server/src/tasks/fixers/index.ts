import createLogger from '../../logger.js';
import { AddPlexServerIdsFixer } from './addPlexServerIds.js';
import { BackfillProgramGroupings } from './backfillProgramGroupings.js';
import Fixer from './fixer.js';
import { MissingSeasonNumbersFixer } from './missingSeasonNumbersFixer.js';

const logger = createLogger(import.meta);

// Run all fixers one-off, swallowing all errors.
// Fixers currently do not keep any state and we will
// just run them at each server start. As such, they
// should be idempotent.
// Maybe one day we'll import these all dynamically and run
// them, but not today.
export const runFixers = async () => {
  const allFixers: Fixer[] = [
    new MissingSeasonNumbersFixer(),
    new AddPlexServerIdsFixer(),
    new BackfillProgramGroupings(),
  ];

  for (const fixer of allFixers) {
    try {
      logger.debug('Running fixer %s', fixer.constructor.name);
      await fixer.run();
    } catch (e) {
      logger.error('Fixer %s failed to run %O', fixer.constructor.name, e);
    }
  }
};
