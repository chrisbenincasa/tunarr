export type Func<In, Out> = {
  apply: (input: In) => Out;
};
