import { ConstantGlobalOption } from './GlobalOption';

export class NoStatsOption extends ConstantGlobalOption {
  constructor() {
    super(['-nostats']);
  }
}
