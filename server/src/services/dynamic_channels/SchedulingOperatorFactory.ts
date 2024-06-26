import { SchedulingOperation } from '@tunarr/types/api';
import { SchedulingOperator } from './SchedulingOperator';
import { PadProgramsSchedulingOperator } from './PadProgramsSchedulingOperator';
import { RandomSortOperator } from './RandomSortOperator';
import { ReleaseDateSortOperator } from './ReleaseDateSortOperator';

export class SchedulingOperatorFactory {
  private constructor() {}

  static create(
    config: SchedulingOperation,
  ): SchedulingOperator<SchedulingOperation> | null {
    switch (config.id) {
      case 'add_padding':
        return new PadProgramsSchedulingOperator(config);
      case 'random_sort':
        return new RandomSortOperator(config);
      case 'release_date_sort':
        return new ReleaseDateSortOperator(config);
      case 'scheduled_redirect':
        // Not implemented
        return null;
    }
  }
}
