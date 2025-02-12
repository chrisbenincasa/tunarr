import type {
  SearchFilter,
  SearchFilterOperatorNode,
  SearchFilterValueNode,
} from '@tunarr/types/api';
import { FreeSearchQueryKeyMappings } from '@tunarr/types/api';
import { createToken, EmbeddedActionsParser, Lexer } from 'chevrotain';
import { isArray } from 'lodash-es';

const Integer = createToken({ name: 'Integer', pattern: /\d+/ });

const FloatingPoint = createToken({
  name: 'FloatingPoint',
  pattern: /\d+\.\d+/,
});

const Identifier = createToken({ name: 'Identifier', pattern: /[a-zA-Z]+/ });

const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

const Comma = createToken({
  name: 'Comma',
  pattern: /,/,
});

const CombineAnd = createToken({
  name: 'CombineAnd',
  pattern: /AND/i,
  longer_alt: Identifier,
});

const CombineOr = createToken({
  name: 'CombineOr',
  pattern: /OR/i,
  longer_alt: Identifier,
});

const OpenParenGroup = createToken({
  name: 'OpenParenGroup',
  pattern: /\(/,
});

const CloseParenGroup = createToken({
  name: 'CloseParenGroup',
  pattern: /\)/,
});

const OpenArray = createToken({
  name: 'OpenArray',
  pattern: /\[/,
});

const CloseArray = createToken({
  name: 'CloseArray',
  pattern: /]/,
});

const Quote = createToken({
  name: 'Quote',
  pattern: /"/,
});

const EqOperator = createToken({ name: 'EqOperator', pattern: /:|=/ });

const NeqOperator = createToken({ name: 'NeqOperator', pattern: /!=/ });

const ContainsOperator = createToken({
  name: 'ContainsOperator',
  pattern: /~/,
});

const LessThanOrEqualOperator = createToken({
  name: 'LTEOperator',
  pattern: /<=/,
});
const LessThanOperator = createToken({ name: 'LTOperator', pattern: /</ });

const GreaterThanOrEqualOperator = createToken({
  name: 'GTEOperator',
  pattern: />=/,
});
const GreaterThanOperator = createToken({ name: 'GTOperator', pattern: />/ });

const InOperator = createToken({ name: 'InOperator', pattern: /in/i });

const allTokens = [
  WhiteSpace,
  Comma,
  OpenArray,
  CloseArray,
  OpenParenGroup,
  CloseParenGroup,
  Quote,
  CombineAnd,
  CombineOr,
  LessThanOrEqualOperator,
  GreaterThanOrEqualOperator,
  EqOperator,
  NeqOperator,
  LessThanOperator,
  GreaterThanOperator,
  InOperator,
  ContainsOperator,
  // Order matters here. float is more specific
  // than int.
  FloatingPoint,
  Integer,
  // Catch all
  Identifier,
];

const SearchExpressionLexer = new Lexer(allTokens);

type StringOps = '=' | '!=' | '<' | '<=' | 'in' | 'contains';
type Ops = '=' | '!=' | '<' | '<=' | '>' | '>=';

export type SearchGroup = {
  type: 'search_group';
  clauses: SearchClause[];
};

export type SingleStringSearchQuery = {
  type: 'single_query';
  field: string;
  op: StringOps;
  value: string | string[];
};

export type SingleNumericQuery = {
  type: 'single_numeric_query';
  field: string;
  // TODO: Use real types
  op: Ops;
  value: number;
};

export type SingleSearch = SingleNumericQuery | SingleStringSearchQuery;

export type SearchClause =
  | SearchGroup
  | SingleStringSearchQuery
  | SingleSearch
  | BinarySearchClause;

export type BinarySearchClause = {
  type: 'binary_clause';
  lhs: SearchClause;
  op: 'and' | 'or';
  rhs: SearchClause;
};

export class SearchParser extends EmbeddedActionsParser {
  constructor() {
    super(allTokens, { recoveryEnabled: false });
    this.performSelfAnalysis();
  }

  private searchValue = this.RULE('searchValue', () => {
    const valueParts: string[] = [];
    this.OR([
      {
        ALT: () => {
          this.CONSUME(Quote, { LABEL: 'str_open' });
          this.AT_LEAST_ONE({
            DEF: () => {
              valueParts.push(
                this.CONSUME(Identifier, { LABEL: 'query' }).image,
              );
            },
          });
          this.CONSUME2(Quote, { LABEL: 'str_close' });
        },
      },
      {
        ALT: () => {
          valueParts.push(this.CONSUME2(Identifier, { LABEL: 'query' }).image);
        },
      },
    ]);

    return valueParts.join(' ');
  });

  private parenGroup = this.RULE('parenGroup', () => {
    this.CONSUME(OpenParenGroup);
    const clauses: SearchClause[] = [];
    this.AT_LEAST_ONE(() => {
      clauses.push(this.SUBRULE(this.searchClause));
    });
    this.CONSUME(CloseParenGroup);

    return {
      type: 'search_group' as const,
      clauses,
    } satisfies SearchGroup;
  });

  private operator = this.RULE('operator', () => {
    return this.OR<{ op: StringOps; value: string | string[] }>([
      {
        ALT: () => {
          const op = this.OR2<StringOps>([
            {
              ALT: () => {
                const tok = this.CONSUME(EqOperator);
                return tok.image === ':' ? '=' : (tok.image as StringOps);
                // const value = this
              },
            },
            {
              ALT: () => this.CONSUME(NeqOperator).image as StringOps,
            },
            {
              ALT: () =>
                this.CONSUME(LessThanOrEqualOperator).image as StringOps,
            },
            // {
            //   ALT: () => this.CONSUME(GreaterThanOrEqualOperator).image as StringOps,
            // },
            {
              ALT: () => this.CONSUME(LessThanOperator).image as StringOps,
            },
            {
              ALT: () => {
                this.CONSUME(ContainsOperator);
                return 'contains';
              },
            },
          ]);

          const value = this.SUBRULE(this.searchValue);
          return {
            op,
            value,
          };
        },
      },
      {
        ALT: () => {
          const op = this.CONSUME(InOperator).image.toLowerCase() as 'in';
          this.CONSUME2(OpenArray);
          const values: string[] = [];
          this.AT_LEAST_ONE_SEP({
            DEF: () => {
              values.push(this.SUBRULE2(this.searchValue));
            },
            SEP: Comma,
          });
          this.CONSUME2(CloseArray);
          return { op, value: values };
        },
      },
    ]);
  });

  private numericOperator = this.RULE('numeric_operator', () => {
    return this.OR<Ops>([
      {
        ALT: () => {
          const tok = this.CONSUME(EqOperator);
          return tok.image === ':' ? '=' : (tok.image as Ops);
        },
      },
      {
        ALT: () => this.CONSUME(NeqOperator).image as Ops,
      },
      {
        ALT: () => this.CONSUME(LessThanOrEqualOperator).image as Ops,
      },
      {
        ALT: () => this.CONSUME(GreaterThanOrEqualOperator).image as Ops,
      },
      {
        ALT: () => this.CONSUME(LessThanOperator).image as Ops,
      },
      {
        ALT: () => this.CONSUME(GreaterThanOperator).image as Ops,
      },
    ]);
  });

  private numericValue = this.RULE('numeric_value', () =>
    this.OR([
      {
        ALT: () => parseFloat(this.CONSUME(FloatingPoint).image),
      },
      {
        ALT: () => parseInt(this.CONSUME(Integer).image),
      },
    ]),
  );

  private singleStringSearch = this.RULE('singleStringSearch', () => {
    const field = this.CONSUME(Identifier, { LABEL: 'field' }).image;
    const { op, value } = this.SUBRULE(this.operator, { LABEL: 'op' });
    return {
      type: 'single_query' as const,
      field,
      op,
      value,
    } satisfies SingleStringSearchQuery;
  });

  private singleNumericSearch = this.RULE('singleNumericSearch', () => {
    return {
      type: 'single_numeric_query' as const,
      field: this.CONSUME(Identifier).image,
      op: this.SUBRULE(this.numericOperator),
      value: this.SUBRULE(this.numericValue),
    } satisfies SingleNumericQuery;
  });

  private singleSearch = this.RULE('singleSearch', () => {
    return this.OR<SingleSearch>([
      {
        ALT: () => this.SUBRULE(this.singleStringSearch),
      },
      {
        ALT: () => this.SUBRULE(this.singleNumericSearch),
      },
    ]);
  });

  private searchClause = this.RULE('searchClause', () => {
    let clause: SearchClause;
    this.OR([
      {
        ALT: () => {
          clause = this.SUBRULE(this.parenGroup);
        },
      },
      {
        ALT: () => {
          let isCombo = false;
          clause = this.SUBRULE(this.singleSearch);
          let rhs: SearchClause;
          let op: 'or' | 'and' = 'and';
          this.OPTION(() => {
            const opToken = this.OR2([
              {
                ALT: () => this.CONSUME(CombineOr),
              },
              {
                ALT: () => this.CONSUME(CombineAnd),
              },
              {
                ALT: () => this.CONSUME(WhiteSpace),
              },
            ]);
            rhs = this.SUBRULE(this.searchClause);
            op = opToken?.tokenType?.name === CombineOr.name ? 'or' : 'and';
            isCombo = true;
          });

          if (isCombo) {
            clause = {
              type: 'binary_clause',
              lhs: clause,
              op,
              rhs: rhs!,
            } satisfies BinarySearchClause;
          }
        },
      },
    ]);

    return clause!;
  });

  public searchExpression = this.RULE('searchExpression', () => {
    const clauses: SearchClause[] = [];
    this.AT_LEAST_ONE(() => {
      clauses.push(this.SUBRULE(this.searchClause));
    });
    return clauses.reduce((prev, value) => {
      return {
        lhs: prev,
        op: 'and',
        rhs: value,
        type: 'binary_clause',
      } satisfies BinarySearchClause;
    });
  });
}

export function parseSearchQuery(queryString: string) {
  return SearchExpressionLexer.tokenize(queryString);
}

// Parse a valid SearchClause into an actual Tunarr SearchFilter
export function parsedSearchToRequest(input: SearchClause): SearchFilter {
  switch (input.type) {
    case 'search_group': {
      if (input.clauses.length === 1) {
        return parsedSearchToRequest(input.clauses[0]);
      }

      return {
        op: 'and',
        type: 'op',
        children: input.clauses.map(parsedSearchToRequest),
      } satisfies SearchFilterOperatorNode;
    }
    case 'single_numeric_query': {
      return {
        type: 'value',
        fieldSpec: {
          key: input.field,
          name: '',
          // TODO: Fix
          op: input.op,
          // TODO: derive better type based on field
          type: 'numeric' as const,
          value: input.value,
        },
      } satisfies SearchFilterValueNode;
    }
    case 'single_query': {
      return {
        type: 'value',
        fieldSpec: {
          // HACK for now
          key: FreeSearchQueryKeyMappings[input.field] ?? input.field,
          name: '',
          // TODO: Fix
          op: input.op === '<' || input.op === '<=' ? 'starts with' : input.op,
          // TODO: derive better type based on field
          type: 'string' as const,
          value: isArray(input.value) ? input.value : [input.value],
        },
      } satisfies SearchFilterValueNode;
    }
    case 'binary_clause': {
      return {
        op: input.op.toLowerCase() as Lowercase<SearchFilterOperatorNode['op']>,
        type: 'op',
        children: [
          parsedSearchToRequest(input.lhs),
          parsedSearchToRequest(input.rhs),
        ],
      } satisfies SearchFilterOperatorNode;
    }
  }
}
