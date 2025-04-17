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

  abstract isSuccess(): this is Success<T, E>;

  isFailure(): this is Failure<T, E> {
    return !this.isSuccess();
  }

  forEach(f: (t: T) => void): void {
    if (this.isSuccess()) {
      f(this._data!);
    }
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

  async flatMapAsync<U, E2 extends E = E>(
    f: (t: T) => Promise<Result<U, E2>>,
  ): Promise<Result<U, E2>> {
    if (this.isFailure()) {
      return this as unknown as Failure<U, E2>;
    }

    return f(this._data!);
  }

  getOrElse<U, Out = T extends U ? U : never>(f: () => Out): Out {
    if (this.isSuccess()) {
      return this._data! as Out;
    } else {
      return f();
    }
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

  filter<U extends T>(f: (t: T) => t is U): Result<U, Error>;
  filter(f: (t: T) => boolean): Result<T, Error>;
  filter<U extends T = T>(
    f: (t: T) => boolean | ((t: T) => t is U),
  ): Result<U, Error> {
    if (this.isFailure()) {
      return this as unknown as Result<U, Error>;
    }

    if (!f(this._data!)) {
      return Result.failure(new Error('Filter was not a match'));
    }

    return this as unknown as Result<U, Error>;
  }

  orAsync(f: () => Promise<Result<T, E>>): Promise<Result<T, E>> {
    if (this.isFailure()) {
      return f();
    }
    return Promise.resolve(this);
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

  isSuccess(): this is Success<T, E> {
    return true;
  }
}

export class Failure<T, E extends Error = Error> extends Result<T, E> {
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

  get error(): E {
    return this._error!;
  }

  static fromString<T>(s: string): Failure<T, Error> {
    return new Failure(new Error(s));
  }
}
