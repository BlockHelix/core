'use client';

import { useEffect, useState } from 'react';
import { useCallbackRef } from '@/lib/use-callback-ref';

// A single event pushed over the SSE stream. `type` is the discriminator
// (deployment today; trading and other event types reuse the same stream).
export interface StreamEvent {
  type: string;
  deploymentId?: string;
  status?: string;
  ts?: number;
  [key: string]: unknown;
}

interface TokenResponse {
  token: string;
  expiresIn: number; // seconds
  streamUrl: string;
}

// Re-mint the token this many ms before it expires so the swap is seamless.
const REMINT_LEAD_MS = 30_000;
// Backoff before retrying a failed token mint (no session, backend down, etc).
const RETRY_MS = 60_000;

/**
 * Opens a live Server-Sent Events connection for the signed-in user and calls
 * `onEvent` for every parsed event. Handles the full token lifecycle:
 *   1. POST /api/stream-token  -> { token, expiresIn, streamUrl }
 *   2. new EventSource(`${streamUrl}?token=${token}`)
 *   3. re-mint + reopen ~30s before the token expires
 * The EventSource itself auto-reconnects on transient drops; we only tear it
 * down and rebuild it to rotate an about-to-expire token, or on unmount.
 *
 * Degrades gracefully: if the token fetch fails (e.g. 401 with no Clerk
 * session), it backs off and retries instead of throwing. Returns the timestamp
 * of the last received event so callers can render a freshness indicator.
 */
export function useEventStream(onEvent?: (e: StreamEvent) => void): { lastEventAt: number | null } {
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  // Stable identity so a changing callback doesn't rebuild the connection.
  const handle = useCallbackRef((e: StreamEvent) => onEvent?.(e));

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let remintTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (remintTimer) clearTimeout(remintTimer);
      if (retryTimer) clearTimeout(retryTimer);
      remintTimer = null;
      retryTimer = null;
    };

    const connect = async () => {
      if (cancelled) return;
      clearTimers();
      if (es) {
        es.close();
        es = null;
      }

      let data: TokenResponse | null = null;
      try {
        const res = await fetch('/api/stream-token', { method: 'POST', cache: 'no-store' });
        if (res.ok) data = (await res.json()) as TokenResponse;
      } catch {
        // network error — fall through to retry
      }

      if (cancelled) return;
      if (!data?.token || !data?.streamUrl) {
        // No token (unauthenticated / upstream error). Back off and retry.
        retryTimer = setTimeout(connect, RETRY_MS);
        return;
      }

      const source = new EventSource(`${data.streamUrl}?token=${encodeURIComponent(data.token)}`);
      es = source;
      source.onmessage = (evt) => {
        // Heartbeats are SSE comments (`:hb`) and never surface here — only real
        // `data:` events do. Record the time even if the JSON is unparseable so
        // the freshness meter still reflects a live connection.
        setLastEventAt(Date.now());
        if (!evt.data) return;
        try {
          handle(JSON.parse(evt.data) as StreamEvent);
        } catch {
          // ignore non-JSON payloads
        }
      };
      // EventSource retries transient drops on its own with the same token; the
      // remint timer below rotates the token well before it expires.

      const lead = Math.max(5_000, data.expiresIn * 1000 - REMINT_LEAD_MS);
      remintTimer = setTimeout(connect, lead);
    };

    void connect();

    return () => {
      cancelled = true;
      clearTimers();
      if (es) es.close();
    };
  }, [handle]);

  return { lastEventAt };
}
