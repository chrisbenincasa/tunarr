import { values } from 'lodash-es';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import { AddPlexServerIdsFixer } from './addPlexServerIds.js';
import { BackfillProgramGroupings } from './backfillProgramGroupings.js';
import Fixer from './fixer.js';
import { MissingSeasonNumbersFixer } from './missingSeasonNumbersFixer.js';
import { BackfillProgramExternalIds } from './BackfillProgramExternalIds.js';

// Run all fixers one-off, swallowing all errors.
// Fixers currently do not keep any state and we will
// just run them at each server start. As such, they
// should be idempotent.
// Maybe one day we'll import these all dynamically and run
// them, but not today.

// It would be nice to do this with dynamic imports, but I don't
// feel like going down that road right now
export const FixersByName: Record<string, Fixer> = {
  [MissingSeasonNumbersFixer.name]: new MissingSeasonNumbersFixer(),
  [AddPlexServerIdsFixer.name]: new AddPlexServerIdsFixer(),
  [BackfillProgramGroupings.name]: new BackfillProgramGroupings(),
  [BackfillProgramExternalIds.name]: new BackfillProgramExternalIds(),
};

const allFixers: Fixer[] = values(FixersByName);

export const runFixers = async () => {
  for (const fixer of allFixers) {
    const name = fixer.constructor.name;
    try {
      LoggerFactory.root.debug(
        'Running fixer %s [background = %O]',
        name,
        fixer.canRunInBackground,
      );
      const fixerPromise = fixer.run();
      if (!fixer.canRunInBackground) {
        await fixerPromise;
        logFixerSuccess(name);
      } else {
        fixerPromise
          .then(() => {
            logFixerSuccess(name);
          })
          .catch((e) => {
            logFixerError(name, e);
          });
      }
    } catch (e) {
      logFixerError(name, e);
    }
  }
};

function logFixerSuccess(fixer: string) {
  LoggerFactory.root.debug('Fixer %s completed successfully', fixer);
}

function logFixerError(fixer: string, error: unknown) {
  LoggerFactory.root.error(error, 'Fixer %s failed to run', fixer);
}
