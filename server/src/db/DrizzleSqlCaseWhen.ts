import type { SQL } from 'drizzle-orm';
import { sql, type AnyColumn } from 'drizzle-orm';

type SQLExpression<T = unknown> =
  | SQL<T>
  | SQL.Aliased<T>
  | AnyColumn<{ data: T }>;

export class SQLCaseWhen<T = never> {
  cases: SQL<T>;
  constructor(init?: SQL<T> | SQLCaseWhen<T>) {
    // Clone the initial cases to enable re-use.
    this.cases = init
      ? sql`${init instanceof SQLCaseWhen ? init.cases : init}`
      : sql<T>`CASE`;
  }

  /**
   * Add a case to the case expression.
   */
  when<Then>(
    whenExpr: SQLExpression,
    thenExpr: SQLExpression<Then>,
  ): SQLCaseWhen<T | Then> {
    this.cases.append(sql` WHEN ${whenExpr} THEN ${thenExpr}`);
    return this;
  }

  /**
   * Add the else clause to the case expression.
   */
  else<Else>(elseExpr: SQLExpression<Else>): SQL<T | Else> {
    return sql`${this.cases} ELSE ${elseExpr} END`;
  }

  /**
   * Finish the case expression without an else clause, which will
   * return `null` if no case matches.
   */
  elseNull(): SQL<T | null> {
    return sql`${this.cases} END`;
  }
}

export function caseWhen<Then>(
  whenExpr: SQLExpression,
  thenExpr: SQLExpression<Then>,
) {
  return new SQLCaseWhen().when(whenExpr, thenExpr);
}
