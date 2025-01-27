import {
  type DatabaseIntrospector,
  type DatabaseMetadata,
  type DatabaseMetadataOptions,
  type Kysely,
  type SchemaMetadata,
  type TableMetadata,
  DEFAULT_MIGRATION_LOCK_TABLE,
  DEFAULT_MIGRATION_TABLE,
  sql,
} from 'kysely';

export class DenoSqliteIntrospector implements DatabaseIntrospector {
  readonly #db: Kysely<unknown>;

  constructor(db: Kysely<unknown>) {
    this.#db = db;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getSchemas(): Promise<SchemaMetadata[]> {
    // Sqlite doesn't support schemas.
    return [];
  }

  async getTables(
    options: DatabaseMetadataOptions = { withInternalKyselyTables: false },
  ): Promise<TableMetadata[]> {
    let query = this.#db
      // @ts-expect-error - untyped
      .selectFrom('sqlite_schema')
      // @ts-expect-error - untyped
      .where('type', '=', 'table')
      // @ts-expect-error - untyped
      .where('name', 'not like', 'sqlite_%')
      // @ts-expect-error - untyped
      .select('name')
      .$castTo<{ name: string }>();

    if (!options.withInternalKyselyTables) {
      query = query
        // @ts-expect-error - untyped
        .where('name', '!=', DEFAULT_MIGRATION_TABLE)
        // @ts-expect-error - untyped
        .where('name', '!=', DEFAULT_MIGRATION_LOCK_TABLE);
    }

    const tables = await query.execute();
    return Promise.all(tables.map(({ name }) => this.#getTableMetadata(name)));
  }

  async getMetadata(
    options?: DatabaseMetadataOptions,
  ): Promise<DatabaseMetadata> {
    return {
      tables: await this.getTables(options),
    };
  }

  async #getTableMetadata(table: string): Promise<TableMetadata> {
    const db = this.#db;

    // Get the SQL that was used to create the table.
    const createSql = await db
      // @ts-expect-error - untyped
      .selectFrom('sqlite_master')
      // @ts-expect-error - untyped
      .where('name', '=', table)
      // @ts-expect-error - untyped
      .select('sql')
      .$castTo<{ sql: string | undefined }>()
      .execute();

    // Try to find the name of the column that has `autoincrement` 🤦
    const autoIncrementCol = createSql[0]?.sql
      ?.split(/[\(\),]/)
      ?.find((it) => it.toLowerCase().includes('autoincrement'))
      ?.split(/\s+/)?.[0]
      ?.replace(/["`]/g, '');

    const columns = await db
      .selectFrom(
        sql<{
          name: string;
          type: string;
          notnull: 0 | 1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dflt_value: any;
        }>`pragma_table_info(${table})`.as('table_info'),
      )
      .select(['name', 'type', 'notnull', 'dflt_value'])
      .execute();

    return {
      name: table,
      columns: columns.map((col) => ({
        name: col.name,
        dataType: col.type,
        isNullable: !col.notnull,
        isAutoIncrementing: col.name === autoIncrementCol,
        hasDefaultValue: col.dflt_value != null,
      })),
      isView: true,
    };
  }
}
