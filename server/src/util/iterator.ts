import type { Nilable } from '../types/util.ts';

async function* map<T, U>(
  it: AsyncIterable<T>,
  fn: (i: T) => U,
): AsyncIterable<U> {
  for await (const i of it) {
    yield fn(i);
  }
}

async function* flatMap<T, U>(
  it: AsyncIterable<T>,
  fn: (i: T) => AsyncIterable<U>,
) {
  for await (const i of it) {
    yield* fn(i);
  }
}

async function* compact<T>(it: AsyncIterable<Nilable<T>>): AsyncIterable<T> {
  for await (const i of it) {
    if (i) {
      yield i;
    }
  }
}

async function* take<T>(it: AsyncIterable<T>, n: number) {
  let idx = 0;
  for await (const i of it) {
    if (idx >= n) {
      break;
    }
    yield i;
    idx++;
  }
}

type Op<In = unknown, Out = unknown> = (i: In) => Out;
function compose<In, OpIn, OpOut>(
  inOp: Op<In, OpIn>,
  wrapOp: Op<OpIn, OpOut>,
): Op<In, OpOut> {
  return (i) => wrapOp(inOp(i));
}

class Chain<T, Out = T> {
  constructor(
    private it: AsyncIterable<T>,
    private op: Op<T, Out>,
  ) {}

  map<U>(fn: (t: Out) => U): Chain<T, U> {
    return new Chain<T, U>(this.it, compose(this.op, fn));
  }

  // flatMap<U>(fn: (t: Out) => AsyncIterable<U>): Chain<T, U> {
  //   return new Chain(this.it, compose(this.op, fn));
  // }

  take(n: number): Chain<T, Out> {
    return new Chain<T, Out>(take(this.it, n), this.op);
  }

  async value(): Promise<Out[]> {
    const res: Out[] = [];
    for await (const i of this.it) {
      res.push(this.op(i));
    }
    return res;
  }
}

function chain<T>(it: AsyncIterable<T>): Chain<T> {
  return new Chain(it, (i) => i);
}

const iterators = {
  map,
  flatMap,
  take,
  chain,
  compact,
};

export default iterators;
