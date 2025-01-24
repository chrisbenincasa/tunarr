import { isError, isString } from 'lodash-es';

export abstract class TypedError extends Error {
  readonly type: KnownErrorTypes;

  constructor(public message: string) {
    super(message);
  }

  static fromError(e: Error): TypedError {
    if (e instanceof TypedError) {
      return e;
    }

    return new GenericError(e.message);
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

export abstract class NotFoundError extends TypedError {}

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
