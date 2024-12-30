import { Maybe } from '@/types/util.ts';
import { isError } from 'lodash-es';

export abstract class Result<T, E extends Error = Error> {
  protected _data: T | undefined;
  protected _error: E | undefined;

  abstract get(): T;

  static attempt<T>(f: () => T): Result<T> {
    try {
      return this.success(f());
    } catch (e) {
      return this.failure(isError(e) ? e : new Error(JSON.stringify(e)));
    }
  }

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

  forEach(f: (t: T) => void): void {
    if (this.isSuccess()) {
      f(this._data!);
    }
  }

  map<U, E2 extends Error = E>(f: (t: T) => U): Result<U, E2> {
    if (this.isFailure()) {
      return this as unknown as Failure<U, E2>;
    }
    try {
      const u = f(this._data!);
      return Result.success(u);
    } catch (e) {
      return Result.failure(e);
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

  flatMap<U, E2 extends E = E>(f: (t: T) => Result<U, E2>): Result<U, E2> {
    if (this.isFailure()) {
      return this as unknown as Failure<U, E2>;
    }

    try {
      return f(this._data!);
    } catch (e) {
      return Result.failure(e);
    }
  }

  async flatMapAsync<U, E2 extends E = E>(
    f: (t: T) => Promise<Result<U, E2>>,
  ): Promise<Result<U, E2>> {
    if (this.isFailure()) {
      return this as unknown as Failure<U, E2>;
    }

    try {
      return f(this._data!);
    } catch (e) {
      return Result.failure(e);
    }
  }

  orElse<U, Out = T extends U ? U : never>(v: Out) {
    return this.isSuccess() ? (this._data! as Out) : v;
  }

  getOrElse<U, Out = T extends U ? U : never>(f: () => Out): Out {
    if (this.isSuccess()) {
      return this._data! as Out;
    } else {
      return f();
    }
  }

  getOrThrow(): T {
    if (this.isFailure()) {
      throw this.error;
    }
    return this._data!;
  }

  orUndefined(): Maybe<T> {
    return this.orElse(undefined);
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

  static fromString<T>(s: string): Failure<T, Error> {
    return new Failure(new Error(s));
  }
}
