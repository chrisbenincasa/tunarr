import { Entity, Enum, Index, ManyToOne, Property, Ref } from '@mikro-orm/core';
import { ExternalId } from '@tunarr/types';
import {
  isValidMultiExternalIdType,
  isValidSingleExternalIdType,
} from '@tunarr/types/schemas';
import { Maybe } from '../../types/util.js';
import { isNonEmptyString } from '../../util/index.js';
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
@Index({
  name: 'unique_program_single_external_id',
  properties: ['program', 'sourceType'],
  expression:
    'create unique index `unique_program_single_external_id` on `program_external_id` (`program_uuid`, `source_type`) WHERE `external_source_id` IS NULL',
})
@Index({
  name: 'unique_program_multi_external_id',
  properties: ['program', 'sourceType', 'externalSourceId'],
  expression:
    'create unique index `unique_program_multiple_external_id` on `program_external_id` (`program_uuid`, `source_type`) WHERE `external_source_id` IS NOT NULL',
})
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
  program!: Ref<Program>;

  toExternalId(): Maybe<ExternalId> {
    const sourceTypeString = this.sourceType.toString();

    if (
      isNonEmptyString(this.externalSourceId) &&
      isValidMultiExternalIdType(sourceTypeString)
    ) {
      return {
        type: 'multi',
        source: sourceTypeString,
        sourceId: this.externalSourceId,
        id: this.externalKey,
      };
    } else if (
      isValidSingleExternalIdType(sourceTypeString) &&
      !isNonEmptyString(this.externalSourceId)
    ) {
      return {
        type: 'single',
        source: sourceTypeString,
        id: this.externalKey,
      };
    }

    console.log('toExternalId fail', this);
    return;
  }

  toKnexInsertData() {
    return {
      uuid: this.uuid,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      source_type: this.sourceType,
      external_source_id: this.externalSourceId,
      external_key: this.externalKey,
      external_file_path: this.externalFilePath,
      direct_file_path: this.directFilePath,
      program_uuid: this.program.uuid,
    };
  }
}
