import { isArray, isObject } from 'lodash-es';

type NullableEnumSchema = {
  nullable?: unknown;
  enum?: unknown;
};

/**
 * OpenAPI 3.0 ignores `nullable: true` next to an `enum`, so client generators
 * read the field as non-nullable. Listing null as an enum member restores it.
 */
export function allowNullInEnums<T>(document: T): T {
  visit(document);
  return document;
}

function visit(node: unknown): void {
  if (isArray(node)) {
    for (const item of node) {
      visit(item);
    }
    return;
  }

  if (!isObject(node)) {
    return;
  }

  const schema = node as NullableEnumSchema;
  if (
    schema.nullable === true &&
    isArray(schema.enum) &&
    !schema.enum.includes(null)
  ) {
    schema.enum.push(null);
  }

  for (const value of Object.values(node)) {
    visit(value);
  }
}
