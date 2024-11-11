import { directDbAccess } from '../../dao/direct/directDbAccess.ts';
import { ProgramType } from '../../dao/direct/schema/Program.ts';
import { ProgramGroupingType } from '../../dao/direct/schema/ProgramGrouping.ts';
import {
  HealthCheck,
  HealthCheckResult,
  HealthyHealthCheckResult,
} from './HealthCheck.ts';

export class MissingSeasonNumbersHealthCheck implements HealthCheck {
  readonly id = 'MissingSeasonNumbers';

  async getStatus(): Promise<HealthCheckResult> {
    const missingFromProgramTable = await directDbAccess()
      .selectFrom('program')
      .select((eb) => eb.fn.count<number>('uuid').as('count'))
      .where('type', '=', ProgramType.Episode)
      .where((eb) => eb.or([eb('seasonNumber', 'is', null)]))
      .executeTakeFirst();

    const missingFromGroupingTable = await directDbAccess()
      .selectFrom('programGrouping')
      .select((eb) => eb.fn.count<number>('uuid').as('count'))
      .where('type', '=', ProgramGroupingType.Season)
      .where('index', 'is', null)
      .executeTakeFirst();

    const totalMissing =
      (missingFromProgramTable?.count ?? 0) +
      (missingFromGroupingTable?.count ?? 0);

    if (totalMissing === 0) {
      return HealthyHealthCheckResult;
    }

    return {
      type: 'warning',
      context: `There are ${totalMissing} program(s) missing a season number`,
    };
  }
}
