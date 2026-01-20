import type { OperatorsByType } from '@tunarr/types/schemas';
import { type SearchField } from '@tunarr/types/schemas';

type Root = 'filter.filter';
type Child = `${Root}.children.${number}`;

export type FieldPrefix = Root | Child;

export type FieldKey<
  Prefix extends FieldPrefix,
  F extends string,
> = `${Prefix}.${F}`;

export type Operators<Type extends SearchField['type']> =
  (typeof OperatorsByType)[Type][number];

export type OperatorLabelMap = {
  [Type in SearchField['type']]: Record<Operators<Type>, string>;
};
