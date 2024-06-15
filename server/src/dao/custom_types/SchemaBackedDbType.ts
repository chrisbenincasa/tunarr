import { Type } from '@mikro-orm/core';
import { z } from 'zod';
import { Logger, LoggerFactory } from '../../util/logging/LoggerFactory';

let _logger: Logger;

export abstract class SchemaBackedDbType<
  T extends z.ZodTypeAny,
  DbType = z.infer<T>,
> extends Type<DbType, string> {
  constructor(private schema: T) {
    super();
  }

  convertToDatabaseValue(value: DbType): string {
    return JSON.stringify(value);
  }

  convertToJSValue(value: string): DbType {
    const jsonParsed: unknown = JSON.parse(value);
    const parseResult = this.schema.safeParse(jsonParsed);
    if (parseResult.success) {
      return parseResult.data as DbType;
    }

    this.logger.error(
      parseResult.error,
      'Unable to parse schema from DB JSON value. Raw parsed JSON: %O',
      jsonParsed,
    );

    throw parseResult.error;
  }

  protected get logger() {
    if (!_logger) {
      _logger = LoggerFactory.child({ className: this.constructor.name });
    }
    return _logger;
  }
}
