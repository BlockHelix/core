// Shared SWR fetcher for the dashboard's read endpoints. Keeps SWR's in-memory
// cache (instant renders on tab switches) while `no-store` ensures every network
// revalidation actually hits our API route rather than a stale HTTP cache.

export class FetchError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Request failed (${res.status})`;
    throw new FetchError(message, res.status);
  }
  return body as T;
}
