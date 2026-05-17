import { getSession, notifyAuthExpired } from './auth-store.js';

function hasRequestBody(body: RequestInit['body']) {
  return body !== undefined && body !== null;
}

function buildHeaders(init?: HeadersInit, body?: RequestInit['body']) {
  const session = getSession();
  const headers = new Headers(init);

  if (!headers.has('content-type') && hasRequestBody(body)) {
    headers.set('content-type', 'application/json');
  }
  if (session?.accessToken) {
    headers.set('authorization', `Bearer ${session.accessToken}`);
  }
  return headers;
}

export async function apiFetch(input: string, init: RequestInit = {}) {
  const response = await fetch(input, {
    ...init,
    headers: buildHeaders(init.headers, init.body),
  });

  if (response.status === 401) {
    notifyAuthExpired();
    throw new Error('Unauthorized');
  }

  return response;
}

export async function apiJson<T>(input: string, init: RequestInit = {}) {
  const response = await apiFetch(input, init);
  return response.json() as Promise<T>;
}
