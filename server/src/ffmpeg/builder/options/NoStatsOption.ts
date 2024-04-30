import { ConstantGlobalOption } from './GlobalOption.ts';

export class NoStatsOption extends ConstantGlobalOption {
  constructor() {
    super(['-nostats']);
  }
}
