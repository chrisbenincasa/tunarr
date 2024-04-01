import {
  Entity,
  ManyToOne,
  PrimaryKeyProp,
  Property,
  Unique,
  type Rel,
} from '@mikro-orm/core';
import { FillerShow } from './FillerShow.js';
import { Program } from './Program.js';

@Entity({ tableName: 'filler_show_content' }) // Original entity was called FillerShow - we want to replace the pivot table
@Unique({ properties: ['fillerList', 'content', 'index'] })
export class FillerListContent {
  @ManyToOne({ primary: true, name: 'filler_show_uuid' })
  fillerList!: Rel<FillerShow>;

  @ManyToOne({ primary: true, name: 'program_uuid' })
  content!: Rel<Program>;

  @Property()
  index!: number;

  [PrimaryKeyProp]?: ['fillerList', 'content'];
}
