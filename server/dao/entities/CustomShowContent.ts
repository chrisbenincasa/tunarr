import {
  Entity,
  ManyToOne,
  PrimaryKeyProp,
  Property,
  Rel,
  Unique,
} from '@mikro-orm/core';
import { CustomShow } from './CustomShow.js';
import { Program } from './Program.js';

@Entity()
@Unique({ properties: ['customShow', 'content', 'index'] })
export class CustomShowContent {
  @ManyToOne({ primary: true, entity: () => CustomShow })
  customShow!: Rel<CustomShow>;

  @ManyToOne({ primary: true, entity: () => Program })
  content!: Rel<Program>;

  @Property()
  index!: number;

  [PrimaryKeyProp]?: ['customShow', 'content'];

  constructor(
    customShow: Rel<CustomShow>,
    content: Rel<Program>,
    index: number,
  ) {
    this.customShow = customShow;
    this.content = content;
    this.index = index;
  }
}
