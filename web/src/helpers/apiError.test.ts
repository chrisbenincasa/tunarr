import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, test } from 'vitest';
import { getApiErrorMessage } from './apiError.ts';

const responseError = (data: unknown) =>
  new AxiosError(
    'Request failed with status code 400',
    'ERR_BAD_REQUEST',
    {
      headers: new AxiosHeaders(),
    },
    undefined,
    {
      data,
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
    },
  );

describe('getApiErrorMessage', () => {
  test('returns a plain string body', () => {
    const message =
      'Slot 0 references custom show abc, which has no content to schedule';
    expect(getApiErrorMessage(responseError(message))).toBe(message);
  });

  test('returns a message field from an object body', () => {
    expect(getApiErrorMessage(responseError({ message: 'Bad slot' }))).toBe(
      'Bad slot',
    );
  });

  test('ignores an empty body', () => {
    expect(getApiErrorMessage(responseError(''))).toBeUndefined();
  });

  test('ignores errors that did not come from the API client', () => {
    expect(getApiErrorMessage(new Error('boom'))).toBeUndefined();
    expect(getApiErrorMessage('boom')).toBeUndefined();
  });
});
