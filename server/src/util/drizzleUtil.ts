import { seq } from '@tunarr/shared/util';
import type {
  ColumnsSelection,
  InferSelectModel,
  SQL,
  TableConfig,
} from 'drizzle-orm';
import { getTableColumns, sql } from 'drizzle-orm';
import { toSnakeCase } from 'drizzle-orm/casing';
import type { SelectResultFields } from 'drizzle-orm/query-builders/select.types';
import type {
  SelectedFields,
  SQLiteTableWithColumns,
  SubqueryWithSelection,
} from 'drizzle-orm/sqlite-core';
import { isObject } from 'lodash-es';
import { mapToObj } from './index.ts';

export function jsonObject<T extends SelectedFields>(shape: T) {
  const chunks: SQL[] = [];

  Object.entries(shape).forEach(([key, value]) => {
    if (chunks.length > 0) {
      chunks.push(sql.raw(`,`));
    }

    chunks.push(sql.raw(`'${key}',`));

    chunks.push(sql`${value}`);
  });

  return sql<SelectResultFields<T>>`coalesce(json_object(${sql.join(
    chunks,
  )}),  ${sql`json_object()`})`;
}

export function jsonAggObject<T extends SelectedFields>(shape: T) {
  return sql<SelectResultFields<T>[]>`coalesce(json_group_array(${jsonObject(
    shape,
  )}), ${sql`json_array()`})`.mapWith(
    (v) => JSON.parse(v as string) as SelectResultFields<T>[],
  );
}

export function createManyRelationAgg<
  TSelection extends ColumnsSelection,
  TAlias extends string,
  TAggAlias extends string,
>(subquery: SubqueryWithSelection<TSelection, TAlias>, aggAlias: TAggAlias) {
  const ent = mapToObj(Object.keys({ ...subquery._.selectedFields }), (key) => {
    return {
      [key]: sql.raw(`"${subquery._.alias}"."${toSnakeCase(key)}"`),
    };
  });

  const sq = sql`(select ${jsonAggObject(ent)} from ${subquery})`;
  return sql.join([sq, sql.raw(`as "${aggAlias}"`)], sql` `);
}

export function mapRawJsonRelationResult<TTableConfig extends TableConfig>(
  input: unknown,
  table: SQLiteTableWithColumns<TTableConfig>,
) {
  const rawExternalIds = input as unknown[] | null | [null] | string;
  const externalIds =
    typeof rawExternalIds === 'string'
      ? (JSON.parse(rawExternalIds) as unknown[])
      : rawExternalIds;
  // We know this is a many relation, so we just map
  return seq.collect(externalIds, (rawExternalId) => {
    if (!isObject(rawExternalId)) {
      return;
    }
    // We don't handle anything special here like aliases, be careful!
    const externalId: Record<string, unknown> = {};
    for (const [colName, colDef] of Object.entries(getTableColumns(table))) {
      externalId[colName] = colDef.mapFromDriverValue(rawExternalId[colName]);
    }
    return externalId as InferSelectModel<typeof table>;
  });
}
