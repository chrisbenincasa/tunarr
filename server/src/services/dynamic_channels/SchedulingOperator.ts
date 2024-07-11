import { SchedulingOperation } from '@tunarr/types/api';
import { ChannelAndLineup } from '../../types/internal.js';

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
    channelAndLineup: ChannelAndLineup,
  ): Promise<ChannelAndLineup>;
}
