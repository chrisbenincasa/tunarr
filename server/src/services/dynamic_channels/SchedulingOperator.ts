import type { SchedulingOperation } from '@tunarr/types/api';
import type { LegacyChannelAndLineup } from '../../db/interfaces/IChannelDB.ts';

// A SchedulingOperator takes a set of lineup items
// and returns a set of lineup items. The operator
// can sort, add, remove, etc, but it must not mutate
// the incoming array.
export abstract class SchedulingOperator<
  ConfigType extends SchedulingOperation,
> {
  protected config: ConfigType;

  constructor(config: ConfigType) {
    this.config = config;
  }

  public abstract apply(
    channelAndLineup: LegacyChannelAndLineup,
  ): Promise<LegacyChannelAndLineup>;
}
