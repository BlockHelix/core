// Client helper for re-running (requeuing) a failed deployment. Retries the
// SAME vault through the backend — it does not create a new vault and does not
// consume another quota slot.

export type RequeueResult =
  | { ok: true }
  | { ok: false; needsForce: boolean; error: string };

export async function requeueVault(id: string, force = false): Promise<RequeueResult> {
  try {
    const url = `/api/vaults/${encodeURIComponent(id)}/requeue${force ? '?force=true' : ''}`;
    const res = await fetch(url, { method: 'POST' });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => null);
    const error = body?.error ?? `Request failed (${res.status})`;
    // The backend answers 400/409 when a force flag is required to requeue a
    // record that isn't in a plain failed state. Offer to retry with force.
    const needsForce = !force && (res.status === 409 || res.status === 400);
    return { ok: false, needsForce, error };
  } catch {
    return { ok: false, needsForce: false, error: 'Network error, try again' };
  }
}
