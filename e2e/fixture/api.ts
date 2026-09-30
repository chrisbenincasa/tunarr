import { SERVER_URL } from './env.ts';

// The generated SDK imports the web app's Zustand store at load time, so the
// seed imports only the generated types and calls the API with fetch.

export async function api<T = unknown>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${SERVER_URL}/api${path}`, {
    method,
    headers:
      body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(
      `${method} ${path} failed with ${res.status}: ${await res.text()}`,
    );
  }

  const text = await res.text();
  return (text.length > 0 ? JSON.parse(text) : undefined) as T;
}
