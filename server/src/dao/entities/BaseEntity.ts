import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { v4 } from 'uuid';

@Entity({ abstract: true })
export abstract class BaseEntity {
  @PrimaryKey()
  uuid: string = v4();

  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @Property({ type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
