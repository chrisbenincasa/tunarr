import {
  Episode,
  MusicAlbum,
  MusicTrack,
  ProgramGrouping,
  Season,
  TerminalProgram,
} from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { IProgramDB } from '../db/interfaces/IProgramDB.ts';
import {
  ProgramGroupingType,
  type ProgramGroupingTypes,
} from '../db/schema/ProgramGrouping.ts';
import { KEYS } from '../types/inject.ts';
import { MaterializeProgramGroupings } from './MaterializeProgramGroupings.ts';
import { MaterializeProgramsCommand } from './MaterializeProgramsCommand.ts';

@injectable()
export class GetProgramGroupingChildren {
  constructor(
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(MaterializeProgramGroupings)
    private materializeProgramGroupings: MaterializeProgramGroupings,
    @inject(MaterializeProgramsCommand)
    private materializePrograms: MaterializeProgramsCommand,
  ) {}

  async execute(
    id: string,
    groupingType: ProgramGroupingTypes['Season'],
  ): Promise<Episode[]>;
  async execute(
    id: string,
    groupingType: ProgramGroupingTypes['Show'],
  ): Promise<Season[]>;
  async execute(
    id: string,
    groupingType: ProgramGroupingTypes['Artist'],
  ): Promise<MusicAlbum[]>;
  async execute(
    id: string,
    groupingType: ProgramGroupingTypes['Album'],
  ): Promise<MusicTrack[]>;
  async execute(
    id: string,
    groupingType: ProgramGroupingType,
  ): Promise<TerminalProgram[] | ProgramGrouping[]> {
    switch (groupingType) {
      case 'artist':
      case 'show': {
        const children = await this.programDB.getChildren(id, groupingType);
        return await this.materializeProgramGroupings.execute(children.results);
      }
      case 'season':
      case 'album': {
        const children = await this.programDB.getChildren(id, groupingType);
        return await this.materializePrograms.execute(children.results);
      }
    }
  }
}
