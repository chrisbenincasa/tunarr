import {
  BaseEntity,
  Entity,
  IType,
  PrimaryKey,
  Property,
  MikroORM,
} from '@mikro-orm/better-sqlite';
import { z } from 'zod';
import { SchemaBackedDbType } from './SchemaBackedDbType';

const basicSchema = z.object({
  key: z.string(),
});

class CustomType extends SchemaBackedDbType<typeof basicSchema> {
  constructor() {
    super(basicSchema);
  }
}

@Entity()
class CustomEntity extends BaseEntity {
  @PrimaryKey({ autoincrement: true, type: 'numeric' })
  id!: number;

  @Property({ type: CustomType, columnType: 'json' })
  jsonField!: IType<z.infer<typeof basicSchema>, string>;
}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ':memory:',
    entities: [CustomEntity],
    debug: ['query', 'query-params'],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();
});

describe('SchemaBackedDbType', () => {
  test('Basic', async () => {
    const em = orm.em.fork();
    em.create(CustomEntity, {
      jsonField: {
        key: 'value',
      },
    });
    await em.flush();

    // Read it back
    await em.findOneOrFail(CustomEntity, 1);

    const two = new CustomEntity();
    two.jsonField = { key: 'value' };
    await em.persistAndFlush(two);

    await em.findOneOrFail(CustomEntity, 2);

    // Insert a bad value...
    await em
      .getConnection()
      .execute(
        'insert into `custom_entity` (`json_field`) values (\'{"key": 1}\') returning `id`',
      );

    await expect(em.findOneOrFail(CustomEntity, 3)).rejects.toThrow();
  });
});
