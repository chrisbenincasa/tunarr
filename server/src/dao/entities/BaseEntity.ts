import {
  Entity,
  OptionalProps,
  BaseEntity as OrmBaseEntity,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import { v4 } from 'uuid';

@Entity({ abstract: true })
export abstract class BaseEntity extends OrmBaseEntity {
  [OptionalProps]?: 'createdAt' | 'updatedAt';

  @PrimaryKey()
  uuid: string = v4();

  @Property({ type: 'datetime' })
  createdAt: Date = new Date();

  @Property({ type: 'datetime', onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
