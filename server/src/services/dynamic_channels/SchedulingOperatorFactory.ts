import { SchedulingOperation } from '@tunarr/types/api';
import { SchedulingOperator } from './SchedulingOperator';
import { PadProgramsSchedulingOperator } from './PadProgramsSchedulingOperator';

export class SchedulingOperatorFactory {
  private constructor() {}

  static create(
    config: SchedulingOperation,
  ): SchedulingOperator<SchedulingOperation> | null {
    switch (config.id) {
      case 'add_padding':
        return new PadProgramsSchedulingOperator(config);
      case 'scheduled_redirect':
        // Not implemented
        return null;
    }
  }
}
