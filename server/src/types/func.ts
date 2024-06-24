export type Func<In, Out> = {
  apply: (input: In) => Out;
};

export type NamedFunc<In, Out> = Func<In, Out> & { name: string };
