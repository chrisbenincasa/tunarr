declare const tagSymbol: unique symbol;
export type Tag<Typ, T> = Typ & { [tagSymbol]: T };
