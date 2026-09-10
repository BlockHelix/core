import { UpstreamError, vaultApiConfig } from '@/lib/server/vault-factory';

/**
 * Trade reconciliation: what each trade promised before it broadcast against what the book did.
 *
 * The backend has recorded this on every confirmed trade for a while, and it reached a log line
 * and an SNS topic and no screen. That is the same failure as the miss it was built to catch: an
 * exit was recommended promising +2.75pp, it cost -4.4pp, and no surface put the two numbers next
 * to each other.
 *
 * `unreconcilable` and `not-checked` are NOT passes. They mean the check could not run, and they
 * have to stay visibly different from a trade that matched its prediction.
 */

export type ReconciliationState = 'ok' | 'flag' | 'block' | 'unreconcilable' | 'not-checked';

export type ReconciliationGap = 'no-prediction' | 'no-basis' | 'no-outcome' | 'not-recorded' | 'unreadable' | null;

export interface ReconciliationSummary {
  state: ReconciliationState;
  gap: ReconciliationGap;
  /** Bps of NAV. Null is unmeasured and renders as a dash, never as zero. */
  predictedBps: number | null;
  realizedBps: number | null;
  divergenceBps: number | null;
  reason: string | null;
  source: string | null;
  basis: 'nav' | 'equity' | 'notional' | null;
  sharePriceBefore: string | null;
  sharePriceAfter: string | null;
}

export interface ReconciledTrade {
  id: string;
  kind: string;
  status: string;
  vaultAddress: string;
  tokenIn: string;
  tokenOut: string;
  txHash: string | null;
  failureReason: string | null;
  createdAt: string;
  reconciliation: ReconciliationSummary;
}

export interface ReconciliationRollup {
  vaultAddress: string;
  trades: number;
  checked: number;
  ok: number;
  flag: number;
  block: number;
  unreconcilable: number;
  notChecked: number;
  worstDivergenceBps: number | null;
  worstTradeId: string | null;
  state: 'block' | 'flag' | 'ok' | 'unproven';
}

export interface TradeReconciliationResponse {
  trades: ReconciledTrade[];
  rollup: ReconciliationRollup | null;
}

// A local copy of the upstream call rather than an edit to vault-factory.ts, which is carrying
// someone else's uncommitted work.
async function upstream(path: string, userId: string): Promise<unknown> {
  const config = vaultApiConfig();
  if (!config) throw new UpstreamError(503, 'Vault deployment service is not configured');
  let res: Response;
  try {
    res = await fetch(`${config.url}${path}`, {
      headers: { 'Content-Type': 'application/json', 'X-API-Key': config.apiKey, 'X-User-Id': userId },
      cache: 'no-store',
    });
  } catch {
    throw new UpstreamError(502, 'Vault deployment service is unreachable');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
    const message =
      typeof o?.message === 'string'
        ? o.message
        : typeof o?.error === 'string'
          ? o.error
          : `Vault deployment service returned ${res.status}`;
    throw new UpstreamError(res.status >= 400 && res.status < 500 ? res.status : 502, message);
  }
  return body;
}

/** A verdict we cannot read is not a verdict. Anything unrecognised lands on `not-checked` so a
 *  broken payload can never paint the panel green. */
const STATES: ReconciliationState[] = ['ok', 'flag', 'block', 'unreconcilable', 'not-checked'];
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

function asSummary(v: unknown): ReconciliationSummary {
  const o = (v ?? {}) as Record<string, unknown>;
  const state = STATES.includes(o.state as ReconciliationState) ? (o.state as ReconciliationState) : 'not-checked';
  return {
    state,
    gap: (o.gap ?? null) as ReconciliationGap,
    predictedBps: num(o.predictedBps),
    realizedBps: num(o.realizedBps),
    divergenceBps: num(o.divergenceBps),
    reason: str(o.reason),
    source: str(o.source),
    basis: (str(o.basis) ?? null) as ReconciliationSummary['basis'],
    sharePriceBefore: str(o.sharePriceBefore),
    sharePriceAfter: str(o.sharePriceAfter),
  };
}

/** Trades for one deployment plus that book's rollup. Both are scoped upstream by user id, so a
 *  caller can only ever read their own. */
export async function getTradeReconciliationUpstream(
  deploymentId: string,
  userId: string,
): Promise<TradeReconciliationResponse> {
  const q = `deploymentId=${encodeURIComponent(deploymentId)}`;
  const [list, roll] = await Promise.all([
    upstream(`/trade?${q}`, userId) as Promise<{ trades?: unknown[] } | null>,
    upstream(`/trade/reconciliation?${q}`, userId) as Promise<{ vaults?: unknown[] } | null>,
  ]);

  const trades = (list?.trades ?? []).map((raw) => {
    const t = raw as Record<string, unknown>;
    return {
      id: String(t.id ?? ''),
      kind: String(t.kind ?? 'trade'),
      status: String(t.status ?? ''),
      vaultAddress: String(t.vaultAddress ?? ''),
      tokenIn: String(t.tokenIn ?? ''),
      tokenOut: String(t.tokenOut ?? ''),
      txHash: str(t.txHash),
      failureReason: str(t.failureReason),
      createdAt: String(t.createdAt ?? ''),
      reconciliation: asSummary(t.reconciliation),
    } satisfies ReconciledTrade;
  });

  const rollup = (roll?.vaults ?? [])[0] as ReconciliationRollup | undefined;
  return { trades, rollup: rollup ?? null };
}
