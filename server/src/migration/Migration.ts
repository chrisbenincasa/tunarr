export interface Migration<
  Schema,
  FromVersion extends number,
  ToVersion extends number,
> {
  from: FromVersion;
  to: ToVersion;
  migrate(schema: Schema): Promise<void>;
}
