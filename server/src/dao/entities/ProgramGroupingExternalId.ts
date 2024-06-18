import {
  Entity,
  Enum,
  ManyToOne,
  Property,
  Unique,
  type Rel,
} from '@mikro-orm/core';
import { BaseEntity } from './BaseEntity.js';
import { ProgramGrouping } from './ProgramGrouping.js';
import { ProgramExternalIdType } from '../custom_types/ProgramExternalIdType.js';

/**
 * References to external sources for a {@link ProgramGrouping}
 */
@Entity()
@Unique({ properties: ['uuid', 'sourceType'] })
export class ProgramGroupingExternalId extends BaseEntity {
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
  // - Plex = various ... but generally the file path on the server
  @Property({ nullable: true })
  externalFilePath?: string;

  @ManyToOne(() => ProgramGrouping)
  group!: Rel<ProgramGrouping>;

  toExternalIdString(): string {
    return `${this.sourceType.toString()}|${this.externalSourceId ?? ''}|${
      this.externalKey
    }`;
  }
}
