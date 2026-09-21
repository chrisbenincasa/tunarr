import { describe, expect, test } from 'vitest';
import { allowNullInEnums } from './openapiUtil.js';

describe('allowNullInEnums', () => {
  test('adds null to a nullable enum', () => {
    const schema = { nullable: true, type: 'string', enum: ['a', 'b'] };
    expect(allowNullInEnums(schema).enum).toEqual(['a', 'b', null]);
  });

  test('leaves a non-nullable enum alone', () => {
    const schema = { type: 'string', enum: ['a', 'b'] };
    expect(allowNullInEnums(schema).enum).toEqual(['a', 'b']);
  });

  test('does not add null twice', () => {
    const schema = { nullable: true, enum: ['a', null] };
    expect(allowNullInEnums(schema).enum).toEqual(['a', null]);
  });

  test('descends into nested objects and arrays', () => {
    const document = {
      components: {
        schemas: {
          Item: {
            properties: {
              scanKind: { nullable: true, enum: ['progressive'] },
            },
            anyOf: [{ nullable: true, enum: [1, 2] }],
          },
        },
      },
    };

    allowNullInEnums(document);

    const { properties, anyOf } = document.components.schemas.Item;
    expect(properties.scanKind.enum).toEqual(['progressive', null]);
    expect(anyOf[0].enum).toEqual([1, 2, null]);
  });
});
