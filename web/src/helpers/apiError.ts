import { isAxiosError } from 'axios';

// The API reports validation failures as a plain string body.
export function getApiErrorMessage(error: unknown): string | undefined {
  if (!isAxiosError(error)) {
    return undefined;
  }

  const data: unknown = error.response?.data;
  if (typeof data === 'string' && data.trim().length > 0) {
    return data;
  }

  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof data.message === 'string'
  ) {
    return data.message;
  }

  return undefined;
}
