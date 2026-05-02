import { isError, isString } from 'lodash-es';
import { isNodeError } from '../util/index.ts';

const WrappedErrorTag = Symbol('wrappedError');

// Extend Error but allow different hierarchies of typed errors
export abstract class WrappedError extends Error {
  [WrappedErrorTag] = true;
  cause?: Error;

  static fromError(e: Error): WrappedError {
    return new (class extends WrappedError {
      cause?: Error | undefined = e;
    })();
  }

  static forMessage(msg: string, cause?: Error): WrappedError {
    return this.fromError(new Error(msg, cause));
  }

  nodeErrorCode(): NodeJS.ErrnoException['code'] {
    return isNodeError(this.cause) ? this.cause?.code : undefined;
  }
}

export abstract class TypedError extends WrappedError {
  readonly type?: KnownErrorTypes = undefined;
  readonly httpCode: number = 500;

  static fromError(e: Error): TypedError {
    if (e instanceof TypedError) {
      return e;
    }

    const err = new GenericError(e.message, { cause: e.cause });
    if (e.stack) {
      err.stack = e.stack;
    }
    return err;
  }

  static fromAny(e: unknown): TypedError {
    if (isError(e)) {
      return this.fromError(e);
    }

    if (isString(e)) {
      return new GenericError(e);
    }

    return new GenericError(JSON.stringify(e));
  }
}

abstract class TypedHttpError<
  StatusT extends number = number,
> extends TypedError {
  readonly _!: StatusT;
  readonly httpCode: StatusT;

  constructor(httpCode: StatusT, message?: string, options?: ErrorOptions) {
    super(message, options);
    this.httpCode = httpCode;
  }
}

export abstract class BadRequestError extends TypedHttpError<400> {
  constructor(...params: ConstructorParameters<ErrorConstructor>) {
    super(400, ...params);
  }
}

abstract class NotFoundError extends TypedHttpError<404> {
  constructor(message?: string, options?: ErrorOptions) {
    super(404, message, options);
  }
}

export class ChannelNotFoundError extends NotFoundError {
  readonly type = 'channel_not_found';
  constructor(channelId: string | number) {
    super(`Channel ${channelId} not found`);
  }
}

export class TranscodeConfigNotFoundError extends NotFoundError {
  readonly type = 'transcode_config_not_found';
  constructor(id: string) {
    super(`Transcode config id = ${id} not found`);
  }
}

export type KnownErrorTypes =
  | 'channel_not_found'
  | 'generic_error'
  | 'transcode_config_not_found';

export class GenericError extends TypedError {
  readonly type = 'generic_error';
}

export class GenericBadRequestError extends BadRequestError {}

export class GenericNotFoundError extends NotFoundError {
  constructor(id: string, entity: string) {
    super(`${entity} entity with id = ${id} not found`);
  }
}
