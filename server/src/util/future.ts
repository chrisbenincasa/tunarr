export class Future<T> implements Promise<T> {
  #promise: Promise<T>;
  #resolve!: (v: T | PromiseLike<T>) => void;
  #reject!: (reason?: unknown) => void;
  #state: 'pending' | 'fulfilled' | 'rejected' = 'pending';
  #value: T | undefined;
  #err: unknown;

  constructor() {
    this.#promise = new Promise<T>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });

    this.#promise.then(
      (v) => {
        this.#state = 'fulfilled';
        this.#value = v;
      },
      (err) => {
        this.#state = 'rejected';
        this.#err = err;
      },
    );
  }

  [Symbol.toStringTag]!: string;

  resolve(value: T | PromiseLike<T>) {
    if (this.#state === 'pending') {
      this.#resolve(value);
    } else {
      throw new Error(
        'Resolving already fulfilled future with state ' + this.#state,
      );
    }
  }

  reject(e: unknown) {
    if (this.#state === 'pending') {
      this.#reject(e);
    } else {
      throw new Error(
        'Rejecting already fulfilled future with state ' + this.#state,
      );
    }
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.#promise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T | TResult> {
    return this.#promise.catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.#promise.finally(onfinally);
  }

  get promise() {
    return this.#promise;
  }

  get state() {
    return this.#state;
  }

  get value() {
    return this.#value;
  }

  get error() {
    return this.#err;
  }
}
