import {
  Entity,
  Enum,
  ManyToOne,
  Property,
  Unique,
  type Rel,
} from '@mikro-orm/core';
import { ProgramExternalIdType } from '../custom_types/ProgramExternalIdType.js';
import { BaseEntity } from './BaseEntity.js';
import { Program } from './Program.js';

/**
 * References to external sources for a {@link Program}
 *
 * There are two flavors of IDs:
 *   1. Source-specific. These are unique in 3 parts: [type, source_id, id]
 *      e.x. a program's ID specific to a user's Plex server
 *   2. Source-agnostic. These are unique in 2 parts: [type, id]
 *      e.x. a program's ID on IMDB
 */
@Entity()
@Unique({ properties: ['uuid', 'sourceType'] })
export class ProgramExternalId extends BaseEntity {
  @Enum(() => ProgramExternalIdType)
  sourceType!: ProgramExternalIdType;

  // Mappings:
  // - Plex = server name
  @Property({ nullable: true })
  externalSourceId?: string;

  // Mappings:
  // - Plex = ratingKey
  @Property()
  externalKey!: string;

  // Mappings:
  // - Plex = Media.Part.key -- how to access the file via Plex server
  @Property({ nullable: true })
  externalFilePath?: string;

  // Mappings:
  // - Plex = Media.Part.file -- the file path _on_ the plex server
  //          used in direct streaming mode
  @Property({ nullable: true })
  directFilePath?: string;

  @ManyToOne(() => Program)
  program!: Rel<Program>;
}
