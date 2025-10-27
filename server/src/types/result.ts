import { isError, isFunction, isNil, isString } from 'lodash-es';
import type { NonUndefinable } from 'ts-essentials/dist/non-undefinable.js';
import { WrappedError } from './errors.ts';
import type { Nullable } from './util.ts';
import { type Maybe } from './util.ts';

declare const resultTypeSym: unique symbol;

export abstract class Result<T, E extends WrappedError = WrappedError> {
  declare readonly _: {
    successType: T;
  };

  protected _data: T | undefined;
  protected _error: E | undefined;

  abstract get(): T;

  static attempt<T>(f: () => T): Result<T> {
    try {
      return this.success(f());
    } catch (e) {
      return this.failure(toWrappedError(e));
    }
  }

  static async attemptAsync<T>(f: () => Promise<T>): Promise<Result<T>> {
    try {
      return this.success(await f());
    } catch (e) {
      return this.failure(toWrappedError(e));
    }
  }

  static forError<T>(e: Error): Result<T, WrappedError> {
    return this.failure(WrappedError.fromError(e));
  }

  static failure<T>(message: string): Result<T, WrappedError>;
  static failure<T, U extends WrappedError>(e: U): Result<T, U>;
  static failure<T>(e: WrappedError | string): Result<T, WrappedError> {
    return new Failure(isString(e) ? WrappedError.forMessage(e) : e);
  }

  static success<T, U extends WrappedError>(d: T): Result<T, U> {
    return new Success(d);
  }

  abstract isSuccess(): this is Success<T, E>;

  isFailure(): this is Failure<T, E> {
    return !this.isSuccess();
  }

  forEach(f: (t: T) => void): void {
    if (this.isSuccess()) {
      f(this._data!);
    }
  }

  ifError(f: (t: E) => void): void {
    if (this.isFailure()) {
      f(this.error);
    }
  }

  async forEachAsync(f: (t: T) => Promise<void>): Promise<void> {
    if (this.isSuccess()) {
      await f(this._data!);
    }
  }

  // Only use this is if the function within will definitely not throw!
  mapPure<U>(f: (t: T) => U): Result<U, E> {
    return this.map(f) as unknown as Result<U, E>;
  }

  // Have to raise the constraint of the error type here in case the
  // map function throws
  map<U>(f: (t: T) => U): Result<U, WrappedError> {
    if (this.isFailure()) {
      return this as unknown as Failure<U, E>;
    }
    try {
      const u = f(this._data!);
      return Result.success(u);
    } catch (e) {
      return Result.failure(toWrappedError(e));
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

  flatMap<U, E2 extends WrappedError = WrappedError>(
    f: (t: T) => Result<U, E2>,
  ): Result<U, E | E2> {
    if (this.isFailure()) {
      return this as unknown as Result<U, E>;
    }

    return f(this._data!);
  }

  flatMapPure<U>(f: (t: T) => Result<U, E>): Result<U, E> {
    return this.flatMap<U, E>(f);
  }

  orElse<U, Out = T extends U ? U : never>(v: Out): U | Out {
    return this.isSuccess() ? (this._data! as Out) : v;
  }

  getOrElse<U, Out = T extends U ? U : never>(f: Out | (() => Out)): Out {
    if (this.isSuccess()) {
      return this._data! as Out;
    } else {
      return isFunction(f) ? f() : f;
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

  orNull(): Nullable<T> {
    return this.orElse(null);
  }

  either<U>(onSuccess: (data: T) => U, onError: (err: E) => U): U {
    return this.isSuccess() ? onSuccess(this._data!) : onError(this._error!);
  }

  or(f: () => Result<T, E>): Result<T, E> {
    if (this.isFailure()) {
      return f();
    }
    return this;
  }

  filter<U extends T>(f: (t: T) => t is U): Result<U, WrappedError>;
  filter(f: (t: T) => boolean): Result<T, WrappedError>;
  filter<U extends T = T>(
    f: (t: T) => boolean | ((t: T) => t is U),
  ): Result<U, WrappedError> {
    if (this.isFailure()) {
      return this as unknown as Result<U, WrappedError>;
    }

    if (!f(this._data!)) {
      return Result.failure(WrappedError.forMessage('Filter was not a match'));
    }

    return this as unknown as Result<U, WrappedError>;
  }

  orAsync(f: () => Promise<Result<T, E>>): Promise<Result<T, E>> {
    if (this.isFailure()) {
      return f();
    }
    return Promise.resolve(this);
  }

  mapError<E2 extends WrappedError>(f: (e: E) => E2): Result<T, E2> {
    if (this.isSuccess()) {
      return this as unknown as Success<T, E2>;
    }
    return Result.failure(f(this._error!));
  }

  ifNil<E2 extends WrappedError>(err: E2): Result<T & {}, E2> {
    if (this.isFailure()) {
      return this as unknown as Result<NonNullable<NonUndefinable<T>>, E2>;
    }
    const v = this.get();
    if (!v) {
      return Result.failure(err);
    }
    return Result.success(v);
  }

  static all<T extends readonly Result<unknown>[] | []>(
    results: T,
  ): Result<{ -readonly [P in keyof T]: T[P]['_']['successType'] }> {
    const out: unknown[] = [];
    for (const r of results) {
      if (r.isSuccess()) {
        out.push(r.get());
      } else {
        return r as Result<{
          -readonly [P in keyof T]: T[P]['_']['successType'];
        }>;
      }
    }

    return Result.success(out) as Result<{
      -readonly [P in keyof T]: T[P]['_']['successType'];
    }>;
  }
}

export class Success<T, E extends WrappedError = WrappedError> extends Result<
  T,
  E
> {
  protected readonly _error: undefined = undefined;
  constructor(data: T) {
    super();
    this._data = data;
  }

  get(): T {
    return this._data!;
  }

  isSuccess(): this is Success<T, E> {
    return true;
  }
}

export class Failure<T, E extends WrappedError = WrappedError> extends Result<
  T,
  E
> {
  constructor(e: E) {
    super();
    this._error = e;
  }

  get(): T {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw this._error;
  }

  isSuccess(): this is Success<T, E> {
    return false;
  }

  recast<U>(): Failure<U, E> {
    return this as unknown as Failure<U, E>;
  }

  get error(): E {
    return this._error!;
  }

  static fromError<T>(e: Error): Failure<T, WrappedError> {
    return new Failure(toWrappedError(e));
  }

  static fromString<T>(s: string): Failure<T, WrappedError> {
    return new Failure(new Error(s) as WrappedError);
  }
}

function toWrappedError(e: unknown): WrappedError {
  if (isNil(e)) {
    return WrappedError.fromError(new Error());
  } else if (isError(e)) {
    return WrappedError.fromError(e);
  } else if (isString(e)) {
    return WrappedError.fromError(new Error(e));
  }
  return WrappedError.fromError(new Error(JSON.stringify(e)));
}
