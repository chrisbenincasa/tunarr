import { ContentProgram } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { GenerationResult } from '../../services/scheduling/InfiniteScheduleGenerator.ts';
import { Command } from '../Command.ts';
import { MaterializeScheduleGeneratedItems } from './MaterializeScheduleGeneratedItems.ts';

type Request = {
  result: GenerationResult;
};

@injectable()
export class MaterializeScheduleGenerationResult
  implements Command<Request, ContentProgram[]>
{
  constructor(
    @inject(MaterializeScheduleGeneratedItems)
    private materializeItems: MaterializeScheduleGeneratedItems,
  ) {}

  run({ result }: Request): Promise<ContentProgram[]> {
    return this.materializeItems.run({ items: result.items });
  }
}
