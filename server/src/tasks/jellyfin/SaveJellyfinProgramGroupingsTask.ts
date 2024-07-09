import { Tag } from '@tunarr/types';
import { Task, TaskId } from '../Task.js';
import { ProgramGroupingCalculator } from '../../dao/ProgramGroupingCalculator.js';
import { ProgramDB } from '../../dao/programDB.js';
import { ProgramType } from '../../dao/entities/Program.js';

type SaveJellyfinProgramGroupingsRequest = {
  programType: ProgramType;
  jellyfinServerName: string;
  programAndJellyfinIds: {
    programId: string;
    jellyfinItemId: string;
    parentKey: string;
  }[];
  parentKeys: string[];
  grandparentKey: string;
};

export class SaveJellyfinProgramGroupingsTask extends Task {
  public ID: string | Tag<TaskId, unknown>;

  constructor(
    private request: SaveJellyfinProgramGroupingsRequest,
    private programDB: ProgramDB = new ProgramDB(),
  ) {
    super();
  }

  protected async runInternal(): Promise<unknown> {
    await new ProgramGroupingCalculator(
      this.programDB,
    ).createHierarchyForManyFromJellyfin(
      this.request.programType,
      this.request.jellyfinServerName,
      this.request.programAndJellyfinIds,
      this.request.parentKeys,
      this.request.grandparentKey,
    );
    return;
  }
}
