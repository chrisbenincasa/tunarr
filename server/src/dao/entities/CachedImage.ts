import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class CachedImage {
  @PrimaryKey()
  hash!: string;

  @Property()
  url!: string;

  @Property({ nullable: true })
  mimeType?: string;
}
