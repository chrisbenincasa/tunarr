import {
  type InferInsertModel,
  type InferSelectModel,
  type MapColumnName,
  type Table,
} from 'drizzle-orm/table';
import { type Simplify } from 'drizzle-orm/utils';
import type { ColumnType, JSONColumnType } from 'kysely';

type InferJson<
  T extends Table,
  Key extends keyof T['_']['columns'] & string,
> = JSONColumnType<
  InferSelectModel<
    T,
    {
      dbColumnNames: true;
    }
  >[MapColumnName<Key, T['_']['columns'][Key], true>],
  T['_']['columns'][Key]['notNull'] extends true ? string : string | null
>;

type InferBool<
  T extends Table,
  Key extends keyof T['_']['columns'] & string,
> = ColumnType<
  number,
  T['_']['columns'][Key]['notNull'] extends true ? number : number | null
>;

type InferDateMs<
  T extends Table,
  Key extends keyof T['_']['columns'] & string,
> = ColumnType<
  number,
  T['_']['columns'][Key]['notNull'] extends true ? number : number | null
>;

export type KyselifyBetter<T extends Table> = Simplify<{
  [Key in keyof T['_']['columns'] & string as MapColumnName<
    Key,
    T['_']['columns'][Key],
    true
  >]: T['_']['columns'][Key]['dataType'] extends 'json'
    ? InferJson<T, Key>
    : T['_']['columns'][Key]['dataType'] extends 'boolean'
      ? InferBool<T, Key>
      : T['_']['columns'][Key]['dataType'] extends 'date'
        ? InferDateMs<T, Key>
        : ColumnType<
            InferSelectModel<
              T,
              {
                dbColumnNames: true;
              }
            >[MapColumnName<Key, T['_']['columns'][Key], true>],
            MapColumnName<
              Key,
              T['_']['columns'][Key],
              true
            > extends keyof InferInsertModel<
              T,
              {
                dbColumnNames: true;
              }
            >
              ? InferInsertModel<
                  T,
                  {
                    dbColumnNames: true;
                  }
                >[MapColumnName<Key, T['_']['columns'][Key], true>]
              : never,
            MapColumnName<
              Key,
              T['_']['columns'][Key],
              true
            > extends keyof InferInsertModel<
              T,
              {
                dbColumnNames: true;
              }
            >
              ? InferInsertModel<
                  T,
                  {
                    dbColumnNames: true;
                  }
                >[MapColumnName<Key, T['_']['columns'][Key], true>]
              : never
          >;
}>;
