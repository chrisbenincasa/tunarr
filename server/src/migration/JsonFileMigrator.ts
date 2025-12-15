import type { interfaces } from 'inversify';
import { sortBy } from 'lodash-es';
import assert from 'node:assert';
import { container } from '../container.ts';
import type { Json } from '../types/schemas.ts';

export interface MigrationStep {
  from: number;
  to: number;
  migrate(input: Json): Promise<void>;
}

export abstract class JsonFileMigrator<StepClass extends MigrationStep> {
  protected pipeline: StepClass[];

  constructor(migrationStepKeys: interfaces.ServiceIdentifier<StepClass>[]) {
    const allSteps = sortBy(
      migrationStepKeys.map((step) => container.get(step)),
      ({ from }) => from,
    );
    for (let i = 0; i < allSteps.length; i++) {
      if (i === 0) {
        continue;
      } else {
        const prevStep = allSteps[i - 1]!;
        const thisStep = allSteps[i]!;
        assert(prevStep.to === thisStep.from);
      }
    }

    this.pipeline = allSteps;
  }

  abstract run(): Promise<void>;
}
