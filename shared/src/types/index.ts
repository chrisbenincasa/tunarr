export type GenSubtypeMapping<T extends { type: string }> = {
  [X in T['type']]: Extract<T, { type: X }>;
};

export type GenGroupedSubtypeMapping<T extends { type: string }> = {
  [X in T['type']]: Extract<T, { type: X }>[];
};

export type PerTypeCallback<Union extends { type: string }, CallbackRet> = {
  [X in Union['type']]?:
    | ((m: GenSubtypeMapping<Union>[X]) => CallbackRet)
    | CallbackRet;
} & {
  default?: ((m: Union) => CallbackRet) | CallbackRet;
};
