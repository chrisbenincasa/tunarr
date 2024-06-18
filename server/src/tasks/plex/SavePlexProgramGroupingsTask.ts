import { Tag } from '@tunarr/types';
import { Task, TaskId } from '../Task.js';
import { ProgramGroupingCalculator } from '../../dao/ProgramGroupingCalculator.js';
import { ProgramDB } from '../../dao/programDB.js';
import { ProgramType } from '../../dao/entities/Program.js';

type SavePlexProgramGroupingsRequest = {
  programType: ProgramType;
  plexServerName: string;
  programAndPlexIds: { programId: string; plexId: string, parentKey }[];
  parentKeys: string[];
  grandparentKey: string;
};

export class SavePlexProgramGroupingsTask extends Task {
  public ID: string | Tag<TaskId, unknown>;

  constructor(
    private request: SavePlexProgramGroupingsRequest,
    private programDB: ProgramDB = new ProgramDB(),
  ) {
    super();
  }

  protected async runInternal(): Promise<unknown> {
    const calculator = new ProgramGroupingCalculator(this.programDB);
    await calculator.createHierarchyForManyFromPlex(
      this.request.programType,
      this.request.plexServerName,
      this.request.programAndPlexIds,
      this.request.parentKeys,
      this.request.grandparentKey,
    );
    return;
  }
}
