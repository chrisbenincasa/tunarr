import { Type } from '@mikro-orm/core';
import { Primitive } from 'ts-essentials';
import type { Tag } from '@tunarr/types';

/**
 * Ability to use a tagged type on an entity field, but transparently save the raw value
 * This allows us some additional type safety when dealing with things like IDs.
 */
export class TaggedDbType<BaseType extends Primitive | Date, TTag> extends Type<
  Tag<BaseType, TTag>,
  BaseType
> {
  convertToDatabaseValue(value: Tag<BaseType, TTag>): BaseType {
    return value;
  }

  convertToJSValue(value: BaseType): Tag<BaseType, TTag> {
    return value as Tag<BaseType, TTag>;
  }
}
