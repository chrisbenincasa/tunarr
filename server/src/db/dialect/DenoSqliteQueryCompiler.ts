import { DefaultQueryCompiler } from 'kysely';

export class DenoSqliteQueryCompiler extends DefaultQueryCompiler {
  protected getCurrentParameterPlaceholder(): string {
    return '?';
  }

  protected getLeftIdentifierWrapper(): string {
    return '"';
  }

  protected getRightIdentifierWrapper(): string {
    return '"';
  }

  protected getAutoIncrement(): string {
    return 'autoincrement';
  }
}
