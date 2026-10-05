import { describe, expect, test } from 'vitest';
import {
  findBadRequestError,
  ScheduleValidationError,
  TypedError,
  unwrapError,
} from './errors.ts';
import { Result } from './result.ts';

async function failWith(error: Error) {
  const result = await Result.attemptAsync(() => Promise.reject(error));
  if (!result.isFailure()) {
    throw new Error('expected a failure');
  }
  return result.error;
}

describe('unwrapError', () => {
  test('recovers a typed error hidden by Result.attemptAsync', async () => {
    const wrapped = await failWith(
      new ScheduleValidationError('Slot 0 is invalid'),
    );

    expect(wrapped).not.toBeInstanceOf(TypedError);
    expect(wrapped.message).toBe('');

    const error = unwrapError(wrapped);
    expect(error).toBeInstanceOf(ScheduleValidationError);
    expect(error.message).toBe('Slot 0 is invalid');
    expect(error instanceof TypedError && error.httpCode).toBe(400);
  });

  test('recovers the message of a plain error', async () => {
    const wrapped = await failWith(new Error('database is locked'));

    expect(unwrapError(wrapped).message).toBe('database is locked');
  });

  test('returns a typed error unchanged', () => {
    const error = new ScheduleValidationError('bad');

    expect(unwrapError(error)).toBe(error);
    expect(findBadRequestError(error)).toBe(error);
  });
});
