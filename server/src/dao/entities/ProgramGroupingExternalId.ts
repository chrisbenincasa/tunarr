import {
  Entity,
  Enum,
  ManyToOne,
  Property,
  Unique,
  type Rel,
} from '@mikro-orm/core';
import { ProgramSourceType } from '../custom_types/ProgramSourceType.js';
import { BaseEntity } from './BaseEntity.js';
import { ProgramGrouping } from './ProgramGrouping.js';

/**
 * References to external sources for a {@link ProgramGrouping}
 */
@Entity()
@Unique({ properties: ['uuid', 'sourceType'] })
export class ProgramGroupingExternalId extends BaseEntity {
  @Enum(() => ProgramSourceType)
  sourceType!: ProgramSourceType;

  // Mappings:
  // - Plex = server name
  @Property()
  externalSourceId!: string;

  // Mappings:
  // - Plex = ratingKey
  @Property()
  externalKey!: string;

  // TODO: Add Plex GUIDs

  // Mappings:
  // - Plex = various ... but generally the file path on the server
  @Property({ nullable: true })
  externalFilePath?: string;

  @ManyToOne(() => ProgramGrouping)
  group!: Rel<ProgramGrouping>;
}
