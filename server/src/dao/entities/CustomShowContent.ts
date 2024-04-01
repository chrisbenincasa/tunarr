import {
  Entity,
  ManyToOne,
  PrimaryKeyProp,
  Property,
  Unique,
  type Rel,
} from '@mikro-orm/core';
import { CustomShow } from './CustomShow.js';
import { Program } from './Program.js';

@Entity()
@Unique({ properties: ['customShow', 'content', 'index'] })
export class CustomShowContent {
  @ManyToOne({ primary: true })
  customShow!: Rel<CustomShow>;

  @ManyToOne({ primary: true })
  content!: Rel<Program>;

  @Property()
  index!: number;

  [PrimaryKeyProp]?: ['customShow', 'content'];
}
