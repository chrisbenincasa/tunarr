import {
  Entity,
  BaseEntity as OrmBaseEntity,
  PrimaryKey,
  Property,
} from '@mikro-orm/core';
import type { IType } from '@mikro-orm/core';
import { v4 } from 'uuid';
import { TaggedDbType } from '../custom_types/BrandedType.js';
import type { Tag } from '@tunarr/types';

/**
 * Trialiing out tagged types on primary keys
 */
@Entity({ abstract: true })
export abstract class TaggedIdBaseEntity<IdTag> extends OrmBaseEntity {
  @PrimaryKey({ type: TaggedDbType<string, IdTag> })
  uuid: IType<Tag<string, IdTag>, string> = v4() as Tag<string, IdTag>;

  @Property({ type: 'datetime', onCreate: () => new Date() })
  createdAt?: Date = new Date();

  @Property({ type: 'datetime', onUpdate: () => new Date() })
  updatedAt?: Date = new Date();
}
