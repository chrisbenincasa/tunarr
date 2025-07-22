import { Logger } from '@/util/logging/LoggerFactory.js';

import { inject, injectable } from 'inversify';
import { JSONPath } from 'jsonpath-plus';
import { IProgramDB } from '../../db/interfaces/IProgramDB.ts';
import { KEYS } from '../../types/inject.ts';
import type { JsonObject } from '../../types/schemas.ts';
import { ChannelLineupMigration } from './ChannelLineupMigration.ts';

export const uuidRegex =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

@injectable()
export class SlotShowIdMigration extends ChannelLineupMigration<1, 2> {
  readonly from = 1;
  readonly to = 2;

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
  ) {
    super();
  }

  async migrate(schema: JsonObject): Promise<void> {
    // Nothing to do if we don't have a schedule.
    if (!schema.schedule) {
      return;
    }

    const results = JSONPath<
      { value: JsonObject; parent: unknown[]; parentPropery: string | number }[]
    >({
      path: `$.schedule.slots[?(@.type === "show" && !@.showId.match(${uuidRegex}))]`,
      json: schema,
      flatten: true,
      resultType: 'all',
    });

    for (const result of results) {
      const name = result.value['showId'] as string;
      const id = await this.programDB.getShowIdFromTitle(name);
      if (id) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        result.parent[result.parentPropery]['showId'] = id;
      } else {
        this.logger.warn('Could not find show_id for slot: %O', result.value);
      }
    }

    return;
  }
}
