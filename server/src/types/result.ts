import { isError } from 'lodash-es';

export abstract class Result<T, E extends Error = Error> {
  protected _data: T | undefined;
  protected _error: E | undefined;

  abstract get(): T;

  static async attemptAsync<T>(f: () => Promise<T>): Promise<Result<T>> {
    try {
      return this.success(await f());
    } catch (e) {
      return this.failure(isError(e) ? e : new Error(JSON.stringify(e)));
    }
  }

  static failure<T, U extends Error>(e: U): Result<T, U> {
    return new Failure(e);
  }

  static success<T, U extends Error>(d: T): Result<T, U> {
    return new Success(d);
  }

  abstract isSuccess(): this is Success<T>;

  isFailure(): this is Failure<T, E> {
    return !this.isSuccess();
  }

  map<U>(f: (t: T) => U): Result<U> {
    if (this.isFailure()) {
      return this as unknown as Failure<U>;
    }
    try {
      const u = f(this._data!);
      return Result.success(u);
    } catch (e) {
      return Result.failure(isError(e) ? e : new Error(JSON.stringify(e)));
    }
  }

  async mapAsync<U>(f: (t: T) => Promise<U>): Promise<Result<U>> {
    if (this.isFailure()) {
      return this as unknown as Failure<U>;
    }
    return f(this._data!)
      .then((u) => Result.success(u))
      .catch((e) => Result.failure(e));
  }
}

export class Success<T, E extends Error = Error> extends Result<T, E> {
  protected readonly _error: E | undefined = undefined;
  constructor(data: T) {
    super();
    this._data = data;
  }

  get(): T {
    return this._data!;
  }

  isSuccess(): this is Success<T> {
    return true;
  }
}

export class Failure<T, E extends Error = Error> extends Result<T, E> {
  constructor(e: E) {
    super();
    this._error = e;
  }

  get(): T {
    throw this._error;
  }

  isSuccess(): this is Success<T> {
    return false;
  }

  get error(): E {
    return this._error!;
  }
}
