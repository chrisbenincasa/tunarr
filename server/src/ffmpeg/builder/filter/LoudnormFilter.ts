import type { LoudnormConfig } from '@tunarr/types';
import { isDefined } from '../../../util/index.ts';
import { FilterOption } from './FilterOption.ts';

export class LoudnormFilter extends FilterOption {
  constructor(
    private loudnormConfig: LoudnormConfig,
    private sampleRate: number,
  ) {
    super();
  }

  public get filter(): string {
    const gain = isDefined(this.loudnormConfig.offsetGain)
      ? `:offset=${this.loudnormConfig.offsetGain}`
      : '';
    return `loudnorm=I=${this.loudnormConfig.i}:LRA=${this.loudnormConfig.lra}:TP=${this.loudnormConfig.tp}${gain},aresample=${this.sampleRate}`;
  }
}
