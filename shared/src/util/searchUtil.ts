import type {
  MediaSourceContentType,
  ProgramLike,
  TupleToUnion,
} from '@tunarr/types';
import type {
  NumericOperators,
  SearchFilter,
  SearchFilterOperatorNode,
  SearchFilterValueNode,
  StringOperators,
} from '@tunarr/types/api';
import { createToken, EmbeddedActionsParser, Lexer } from 'chevrotain';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import { identity, isArray, isNumber } from 'lodash-es';
import type { NonEmptyArray, StrictExclude, StrictOmit } from 'ts-essentials';
import { match } from 'ts-pattern';

dayjs.extend(customParseFormat);

const Integer = createToken({ name: 'Integer', pattern: /\d+/ });

const FloatingPoint = createToken({
  name: 'FloatingPoint',
  pattern: /\d+\.\d+/,
});

const Identifier = createToken({
  name: 'Identifier',
  pattern: /[a-zA-Z0-9-]+/,
});

const StringChars = createToken({
  name: 'StringChars',
  pattern: /[^"\\{]+/,
});

const StringFields = [
  'actor',
  'genre',
  'director',
  'writer',
  'studio',
  'library_id',
  'title',
  'video_codec',
  'video_dynamic_range',
  'audio_codec',
  'tags',
  'rating',
  'type',
  'show_title',
  'show_genre',
  'show_tag',
] as const;

const StringField = createToken({
  name: 'StringField',
  pattern: new RegExp(StringFields.join('|')),
  longer_alt: Identifier,
});

const DateFields = ['release_date'] as const;

const DateField = createToken({
  name: 'DateField',
  pattern: new RegExp(DateFields.join('|')),
  longer_alt: Identifier,
});

const NumericFields = [
  'duration',
  'minutes',
  'seconds',
  'video_bit_depth',
  'video_height',
  'video_width',
  'audio_channels',
  'release_year',
] as const;

const NumericField = createToken({
  name: 'NumericField',
  pattern: new RegExp(NumericFields.join('|')),
  longer_alt: Identifier,
});

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

const OpenQuote = createToken({
  name: 'Quote',
  pattern: /"/,
  push_mode: 'stringMode',
});

const CloseQuote = createToken({
  name: 'Quote',
  pattern: /"/,
  pop_mode: true,
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

const NotOperator = createToken({ name: 'NotOperator', pattern: /not/i });

const InOperator = createToken({ name: 'InOperator', pattern: /in/i });

const BetweenOperator = createToken({
  name: 'BetweenOperator',
  pattern: /between/i,
});

const allTokens = [
  WhiteSpace,
  Comma,
  OpenArray,
  CloseArray,
  OpenParenGroup,
  CloseParenGroup,
  OpenQuote,
  CombineAnd,
  CombineOr,
  LessThanOrEqualOperator,
  GreaterThanOrEqualOperator,
  EqOperator,
  NeqOperator,
  LessThanOperator,
  GreaterThanOperator,
  NotOperator,
  InOperator,
  BetweenOperator,
  ContainsOperator,
  // Order matters here. float is more specific
  // than int.
  FloatingPoint,
  Integer,
  // Fields
  StringField,
  DateField,
  NumericField,
  // Catch all
  Identifier,
];

const SearchExpressionLexer = new Lexer({
  modes: {
    stringMode: [WhiteSpace, CloseQuote, StringChars],
    normalMode: allTokens,
  },
  defaultMode: 'normalMode',
});

const StringOps = ['=', '!=', '<', '<=', 'in', 'not in', 'contains'] as const;
type StringOps = TupleToUnion<typeof StringOps>;
const NumericOps = ['=', '!=', '<', '<=', '>', '>=', 'between'] as const;
type NumericOps = TupleToUnion<typeof NumericOps>;
const DateOps = ['=', '<', '<=', '>', '>=', 'between'] as const;
type DateOps = TupleToUnion<typeof DateOps>;

const StringOpToApiType = {
  '<': 'starts with',
  '<=': 'starts with',
  '!=': '!=',
  '=': '=',
  contains: 'contains',
  in: 'in',
  'not in': 'not in',
} satisfies Record<StringOps, StringOperators>;

const NumericOpToApiType = {
  '!=': '!=',
  '<': '<',
  '<=': '<=',
  '=': '=',
  '>': '>',
  '>=': '>=',
  // This depends on inclusivity
  between: 'to',
} satisfies Record<NumericOps, NumericOperators>;

export type SearchGroup = {
  type: 'search_group';
  clauses: SearchClause[];
};

export type SingleStringSearchQuery = {
  type: 'single_query';
  field: string;
  op: StringOps;
  value: string | NonEmptyArray<string>;
  negate?: boolean;
};

export type SingleNumericQuery =
  | {
      type: 'single_numeric_query';
      field: string;
      op: StrictExclude<NumericOps, 'between'>;
      value: number;
    }
  | {
      type: 'single_numeric_query';
      op: 'between';
      field: string;
      value: [number, number];
      includeLow: boolean;
      includeHigher: boolean;
    };

export type SingleDateSearchQuery =
  | {
      type: 'single_date_query';
      field: string;
      op: StrictExclude<DateOps, 'between'>;
      value: string;
    }
  | {
      type: 'single_date_query';
      op: 'between';
      field: string;
      value: [string, string];
      includeLow: boolean;
      includeHigher: boolean;
    };

export type SingleSearch =
  | SingleNumericQuery
  | SingleStringSearchQuery
  | SingleDateSearchQuery;

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

export const virtualFieldToIndexField: Record<string, string> = {
  genre: 'genres.name',
  actor: 'actors.name',
  writer: 'writer.name',
  director: 'director.name',
  studio: 'studio.name',
  year: 'originalReleaseYear',
  release_date: 'originalReleaseDate',
  release_year: 'originalReleaseYear',
  // these get mapped to the duration field and their
  // values get converted to the appropriate units
  minutes: 'duration',
  seconds: 'duration',
  // This isn't really true, since this could map to multiple fields
  // TODO: Make grouping-tyhpe specific subdocs
  show_genre: 'grandparent.genres',
  show_title: 'grandparent.title',
  show_tag: 'grandparent.tag',
  grandparent_genre: 'grandparent.genres',
  video_bit_depth: 'videoBitDepth',
  video_codec: 'videoCodec',
  video_height: 'videoHeight',
  video_width: 'videoWidth',
  audio_codec: 'audioCodec',
  audio_channels: 'audioChannels',
};

function normalizeReleaseDate(value: string) {
  for (const format of ['YYYY-MM-DD', 'YYYYMMDD']) {
    const d = dayjs(value, format, true);
    if (d.isValid()) {
      return +d;
    }
  }
  throw new Error(`Could not parse inputted date string: ${value}`);
}

type Converter<In, Out = In> = (input: In) => Out;

const numericFieldNormalizersByField = {
  minutes: (mins: number) => mins * 60 * 1000,
  seconds: (secs: number) => secs * 1000,
} satisfies Record<string, Converter<number>>;

const dateFieldNormalizersByField = {
  release_date: normalizeReleaseDate,
} satisfies Record<string, Converter<string, number>>;

export class SearchParser extends EmbeddedActionsParser {
  constructor() {
    super(allTokens, { recoveryEnabled: false });
    this.performSelfAnalysis();
  }

  private searchValue = this.RULE('searchValue', () => {
    const valueParts: string[] = [];
    return this.OR([
      {
        // Attempt to consume a quoted string.
        ALT: () => {
          this.CONSUME(OpenQuote, { LABEL: 'str_open' });
          this.AT_LEAST_ONE({
            DEF: () => {
              this.MANY(() => {
                valueParts.push(
                  this.CONSUME2(StringChars, { LABEL: 'query' }).image,
                );
              });
            },
          });
          this.CONSUME3(CloseQuote, { LABEL: 'str_close' });
          return valueParts.join(' ');
        },
      },
      {
        // Attempt to consume an unquoted string. Consumes both "integers" and "identifiers"
        // and joins them with empty string to complete a singular string. This handles things
        // like dates, e.g. 2025-03-02
        ALT: () => {
          this.MANY2(() => {
            this.OR3([
              {
                ALT: () =>
                  valueParts.push(
                    this.CONSUME4(Identifier, { LABEL: 'query' }).image,
                  ),
              },
              {
                ALT: () =>
                  valueParts.push(
                    this.CONSUME4(Integer, { LABEL: 'query' }).image,
                  ),
              },
            ]);
          });

          return valueParts.join('');
        },
      },
    ]);
  });

  private stringOperator = this.RULE('string_operator', () => {
    return this.OR<{
      op: StringOps;
      value: string | NonEmptyArray<string>;
      negate?: boolean;
    }>([
      {
        ALT: () => {
          const op = this.OR2<StringOps>([
            {
              ALT: () => {
                const tok = this.CONSUME(EqOperator);
                return tok.image === ':' ? '=' : (tok.image as StringOps);
              },
            },
            {
              ALT: () => this.CONSUME(NeqOperator).image as StringOps,
            },
            {
              ALT: () =>
                this.CONSUME(LessThanOrEqualOperator).image as StringOps,
            },
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
          let negate = false;
          if (this.OPTION(() => this.CONSUME(NotOperator))) {
            negate = true;
          }
          const op = this.CONSUME2(InOperator).image.toLowerCase() as 'in';
          this.CONSUME3(OpenArray);
          const values: string[] = [];
          this.AT_LEAST_ONE_SEP({
            DEF: () => {
              values.push(this.SUBRULE2(this.searchValue));
            },
            SEP: Comma,
          });
          this.CONSUME4(CloseArray);
          // Safe because of "at least one" above
          return { op, value: values as NonEmptyArray<string>, negate };
        },
      },
    ]);
  });

  private numericOperator = this.RULE('numeric_operator', () => {
    return this.OR<StrictOmit<SingleNumericQuery, 'field'>>([
      {
        ALT: () => {
          const op = this.OR2<StrictExclude<NumericOps, 'between'>>([
            {
              ALT: () => {
                const tok = this.CONSUME(EqOperator);
                return tok.image === ':' ? '=' : (tok.image as '=');
              },
            },
            {
              ALT: () => this.CONSUME(NeqOperator).image as '!=',
            },
            {
              ALT: () => this.CONSUME(LessThanOrEqualOperator).image as '<=',
            },
            {
              ALT: () => this.CONSUME(GreaterThanOrEqualOperator).image as '>=',
            },
            {
              ALT: () => this.CONSUME(LessThanOperator).image as '<',
            },
            {
              ALT: () => this.CONSUME(GreaterThanOperator).image as '>',
            },
          ]);

          const value = this.SUBRULE(this.numericValue);
          return {
            op,
            value,
            type: 'single_numeric_query',
          } satisfies StrictOmit<SingleNumericQuery, 'field'>;
        },
      },
      {
        ALT: () => {
          const op = this.CONSUME(
            BetweenOperator,
          ).image.toLowerCase() as 'between';
          let inclLow = false,
            inclHi = false;
          this.OR3([
            {
              ALT: () => this.CONSUME2(OpenParenGroup),
            },
            {
              ALT: () => {
                this.CONSUME2(OpenArray);
                inclLow = true;
              },
            },
          ]);
          const values: number[] = [];
          values.push(this.SUBRULE2(this.numericValue));
          this.OPTION(() => this.CONSUME2(Comma));
          values.push(this.SUBRULE3(this.numericValue));
          this.OR4([
            {
              ALT: () => this.CONSUME3(CloseParenGroup),
            },
            {
              ALT: () => {
                this.CONSUME3(CloseArray);
                inclHi = true;
              },
            },
          ]);
          return {
            op,
            value: values as [number, number],
            includeHigher: inclHi,
            includeLow: inclLow,
            type: 'single_numeric_query',
          } satisfies StrictOmit<SingleNumericQuery, 'field'>;
        },
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

  private dateOperatorAndValue = this.RULE('date_operator', () => {
    return this.OR<StrictOmit<SingleDateSearchQuery, 'field'>>([
      {
        ALT: () => {
          const op = this.OR2<StrictExclude<DateOps, 'between'>>([
            {
              ALT: () => {
                const tok = this.CONSUME(EqOperator);
                return tok.image === ':' ? '=' : (tok.image as '=');
              },
            },
            {
              ALT: () => this.CONSUME(LessThanOrEqualOperator).image as '<=',
            },
            {
              ALT: () => this.CONSUME(LessThanOperator).image as '<',
            },
            {
              ALT: () => this.CONSUME(GreaterThanOrEqualOperator).image as '>=',
            },
            {
              ALT: () => this.CONSUME(GreaterThanOperator).image as '>',
            },
          ]);

          const value = this.SUBRULE(this.searchValue);
          return {
            type: 'single_date_query',
            op,
            value,
          } satisfies StrictOmit<SingleDateSearchQuery, 'field'>;
        },
      },
      {
        ALT: () => {
          const op = this.CONSUME(
            BetweenOperator,
          ).image.toLowerCase() as 'between';
          let inclLow = false,
            inclHi = false;
          this.OR3([
            {
              ALT: () => this.CONSUME2(OpenParenGroup),
            },
            {
              ALT: () => {
                this.CONSUME2(OpenArray);
                inclLow = true;
              },
            },
          ]);
          const values: string[] = [];
          values.push(this.SUBRULE2(this.searchValue));
          this.OPTION(() => this.CONSUME2(Comma));
          values.push(this.SUBRULE3(this.searchValue));
          this.OR4([
            {
              ALT: () => this.CONSUME3(CloseParenGroup),
            },
            {
              ALT: () => {
                this.CONSUME3(CloseArray);
                inclHi = true;
              },
            },
          ]);
          return {
            op,
            value: values as [string, string],
            includeHigher: inclHi,
            includeLow: inclLow,
            type: 'single_date_query',
          } satisfies StrictOmit<SingleDateSearchQuery, 'field'>;
        },
      },
    ]);
  });

  private singleStringSearch = this.RULE('singleStringSearch', () => {
    const field = this.CONSUME(StringField, { LABEL: 'field' }).image;
    const { op, value, negate } = this.SUBRULE(this.stringOperator, {
      LABEL: 'op',
    });
    return {
      type: 'single_query' as const,
      field,
      op,
      value,
      negate,
    } satisfies SingleStringSearchQuery;
  });

  private singleNumericSearch = this.RULE('singleNumericSearch', () => {
    const field = this.CONSUME(NumericField).image;
    const opRet = this.SUBRULE(this.numericOperator);

    if (opRet.op === 'between') {
      return {
        type: 'single_numeric_query' as const,
        field,
        op: 'between',
        value: opRet.value,
        includeHigher: opRet.includeHigher,
        includeLow: opRet.includeLow,
      } satisfies SingleNumericQuery;
    }

    return {
      type: 'single_numeric_query' as const,
      field,
      op: opRet.op,
      value: opRet.value,
    } satisfies SingleNumericQuery;
  });

  private singleDateSearch = this.RULE('singleDateSearch', () => {
    const field = this.CONSUME(DateField, { LABEL: 'field' }).image;
    const opRet = this.SUBRULE(this.dateOperatorAndValue, { LABEL: 'op' });
    if (opRet.op === 'between') {
      return {
        type: 'single_date_query',
        field,
        op: 'between',
        value: opRet.value,
        includeHigher: opRet.includeHigher,
        includeLow: opRet.includeLow,
      } satisfies SingleDateSearchQuery;
    }

    return {
      type: 'single_date_query',
      field,
      op: opRet.op,
      value: opRet.value,
    } satisfies SingleDateSearchQuery;
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

  private singleSearch = this.RULE('singleSearch', () => {
    return this.OR<SingleSearch>([
      {
        ALT: () => this.SUBRULE(this.singleStringSearch),
      },
      {
        ALT: () => this.SUBRULE(this.singleNumericSearch),
      },
      {
        ALT: () => this.SUBRULE(this.singleDateSearch),
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

export function tokenizeSearchQuery(queryString: string) {
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
      const key: string = virtualFieldToIndexField[input.field] ?? input.field;
      const valueConverter: Converter<number> =
        input.field in numericFieldNormalizersByField
          ? numericFieldNormalizersByField[
              input.field as keyof typeof numericFieldNormalizersByField
            ]
          : identity;

      // Anything other than full inclusive needs to be translated
      // to a binary query.
      if (input.op === 'between') {
        return match([input.includeLow, input.includeHigher])
          .returnType<SearchFilter>()
          .with(
            [true, true],
            () =>
              ({
                type: 'value',
                fieldSpec: {
                  key,
                  name: '',
                  op: NumericOpToApiType[input.op],
                  type: 'numeric' as const,
                  value: [
                    valueConverter(input.value[0]),
                    valueConverter(input.value[1]),
                  ],
                },
              }) satisfies SearchFilterValueNode,
          )
          .otherwise(([inclLow, inclHi]) => {
            const lhs = {
              type: 'value',
              fieldSpec: {
                key,
                name: '',
                op: inclLow ? '>=' : '>',
                type: 'numeric',
                value: valueConverter(input.value[0]),
              },
            } satisfies SearchFilterValueNode;

            const rhs = {
              type: 'value',
              fieldSpec: {
                key,
                name: '',
                op: inclHi ? '<=' : '<',
                type: 'numeric',
                value: valueConverter(input.value[1]),
              },
            } satisfies SearchFilterValueNode;

            return {
              type: 'op',
              op: 'and',
              children: [lhs, rhs],
            };
          });
      }

      return {
        type: 'value',
        fieldSpec: {
          key,
          name: '',
          op: NumericOpToApiType[input.op],
          type: 'numeric' as const,
          value: valueConverter(input.value),
        },
      } satisfies SearchFilterValueNode;
    }
    case 'single_date_query': {
      const key: string = virtualFieldToIndexField[input.field] ?? input.field;
      const converter =
        input.field in dateFieldNormalizersByField
          ? dateFieldNormalizersByField[
              input.field as keyof typeof dateFieldNormalizersByField
            ]
          : (input: string) => parseInt(input);

      if (input.op === 'between') {
        return {
          type: 'value',
          fieldSpec: {
            key,
            name: '',
            op: NumericOpToApiType[input.op],
            type: 'date' as const,
            value: [converter(input.value[0]), converter(input.value[1])],
          },
        } satisfies SearchFilterValueNode;
      } else {
        return {
          type: 'value',
          fieldSpec: {
            key,
            name: '',
            op: NumericOpToApiType[input.op],
            type: 'date' as const,
            value: converter(input.value),
          },
        } satisfies SearchFilterValueNode;
      }
    }
    case 'single_query': {
      const key: string = virtualFieldToIndexField[input.field] ?? input.field;

      const op = match(input)
        .returnType<StringOperators>()
        .with({ op: 'in', negate: true }, () => 'not in')
        .otherwise(() => StringOpToApiType[input.op]);

      return {
        type: 'value',
        fieldSpec: {
          key,
          name: '',
          op,
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

export function searchFilterToString(
  input: SearchFilter,
  depth: number = 0,
): string {
  switch (input.type) {
    case 'op': {
      const children = input.children.map((child) =>
        searchFilterToString(child, depth + 1),
      );
      if (depth === 0) {
        return children.join(` ${input.op.toUpperCase()} `);
      }
      // Wrap in parents for higher depth
      return `(${children.join(` ${input.op.toUpperCase()} `)})`;
    }
    case 'value': {
      let valueString: string;
      if (isNumber(input.fieldSpec.value)) {
        valueString = input.fieldSpec.value.toString();
      } else if (input.fieldSpec.value.length === 1) {
        const value = input.fieldSpec.value[0];
        let repr: string;
        if (value.includes(' ')) {
          repr = `"${value}"`;
        } else {
          repr = value;
        }
        return `${input.fieldSpec.key} ${input.fieldSpec.op} ${repr}`;
      } else {
        const components: string[] = [];
        for (const x of input.fieldSpec.value) {
          if (isNumber(x)) {
            components.push(x.toString());
          } else {
            components.push(x.includes(' ') ? `"${x}"` : x);
          }
        }
        valueString = `[${components.join(', ')}]`;
      }
      return `${input.fieldSpec.key} ${input.fieldSpec.op} ${valueString}`;
    }
  }
}

export function searchItemTypeFromContentType(
  mediaType: MediaSourceContentType,
): ProgramLike['type'] {
  switch (mediaType) {
    case 'movies':
      return 'movie';
    case 'shows':
      return 'show';
    case 'tracks':
      return 'artist';
    case 'other_videos':
      return 'other_video';
    case 'music_videos':
      return 'music_video';
  }
}

export function makeSearchTypeFilter(
  mediaType: MediaSourceContentType,
): SearchFilter {
  return {
    type: 'value',
    fieldSpec: {
      key: 'type',
      name: 'Type',
      op: '=',
      type: 'string',
      value: [searchItemTypeFromContentType(mediaType)],
    },
  };
}
