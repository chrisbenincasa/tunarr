import { getDatabase } from '@/db/DBAccess.ts';
import { find } from 'lodash-es';
import { P, match } from 'ts-pattern';
import {
  HealthCheck,
  HealthCheckResult,
  HealthyHealthCheckResult,
  healthCheckResult,
} from './HealthCheck.ts';

export class MissingProgramAssociationsHealthCheck implements HealthCheck {
  readonly id: string = this.constructor.name;

  async getStatus(): Promise<HealthCheckResult> {
    const missingParents = await getDatabase()
      .selectFrom('program')
      .select((eb) => ['type', eb.fn.count<number>('uuid').as('count')])
      .where((eb) =>
        eb.or([
          eb.and([
            eb('type', '=', 'episode'),
            eb.or([eb('tvShowUuid', 'is', null), eb('seasonUuid', 'is', null)]),
          ]),
          eb.and([
            eb('type', '=', 'track'),
            eb.or([eb('albumUuid', 'is', null), eb('artistUuid', 'is', null)]),
          ]),
        ]),
      )
      .groupBy('type')
      .$narrowType<{ type: 'episode' | 'track' }>()
      .execute();

    const missingEpisodeAssociations =
      find(missingParents, { type: 'episode' })?.count ?? 0;
    const missingTrackAssociations =
      find(missingParents, { type: 'track' })?.count ?? 0;

    return match([
      missingEpisodeAssociations,
      missingTrackAssociations,
    ] as const)
      .with([0, P.number.gt(0)], () =>
        healthCheckResult({
          type: 'warning',
          context: `There were ${missingTrackAssociations} audio track(s) missing parent associations in the DB. This can lead to a broken XMLTV/Guide`,
        }),
      )
      .with([P.number.gt(0), 0], () =>
        healthCheckResult({
          type: 'warning',
          context: `There were ${missingEpisodeAssociations} episode(s) missing parent associations in the DB. This can lead to a broken XMLTV/Guide`,
        }),
      )
      .with([P.number.gt(0), P.number.gt(0)], () =>
        healthCheckResult({
          type: 'warning',
          context: `There were ${missingEpisodeAssociations} episode(s) and ${missingTrackAssociations} audio track(s) missing parent associations in the DB. This can lead to a broken XMLTV/Guide`,
        }),
      )
      .otherwise(() => HealthyHealthCheckResult);
  }
}
