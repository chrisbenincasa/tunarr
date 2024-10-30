import { round, values } from 'lodash-es';
import { groupByUniq } from '../../util/index.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import { BackfillProgramExternalIds } from './BackfillProgramExternalIds.js';
import { AddPlexServerIdsFixer } from './addPlexServerIds.js';
import { BackfillProgramGroupings } from './backfillProgramGroupings.js';
import Fixer from './fixer.js';
import { MissingSeasonNumbersFixer } from './missingSeasonNumbersFixer.js';

// Run all fixers one-off, swallowing all errors.
// Fixers currently do not keep any state and we will
// just run them at each server start. As such, they
// should be idempotent.
// Maybe one day we'll import these all dynamically and run
// them, but not today.

// It would be nice to do this with dynamic imports, but I don't
// feel like going down that road right now

export const FixersByName: Record<string, Fixer> = groupByUniq(
  [
    new MissingSeasonNumbersFixer(),
    new AddPlexServerIdsFixer(),
    new BackfillProgramGroupings(),
    new BackfillProgramExternalIds(),
  ],
  (f) => f.constructor.name,
);

const allFixers: Fixer[] = values(FixersByName);

export const runFixers = async () => {
  for (const fixer of allFixers) {
    const name = fixer.constructor.name;
    const start = performance.now();
    try {
      LoggerFactory.root.debug(
        { background: fixer.canRunInBackground },
        'Running fixer %s',
        name,
      );
      const fixerPromise = fixer.run();
      if (!fixer.canRunInBackground) {
        await fixerPromise;
        logFixerSuccess(name, performance.now() - start);
      } else {
        fixerPromise
          .then(() => {
            logFixerSuccess(name, performance.now() - start);
          })
          .catch((e) => {
            logFixerError(name, e, performance.now() - start);
          });
      }
    } catch (e) {
      logFixerError(name, e, performance.now() - start);
    }
  }
};

function logFixerSuccess(fixer: string, duration: number) {
  LoggerFactory.root.debug(
    'Fixer %s completed successfully (%d ms)',
    fixer,
    round(duration, 2),
  );
}

function logFixerError(fixer: string, error: unknown, duration: number) {
  LoggerFactory.root.error(
    error,
    'Fixer %s failed to run (%d ms)',
    fixer,
    round(duration, 2),
  );
}
