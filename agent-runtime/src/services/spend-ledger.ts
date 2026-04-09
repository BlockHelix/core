import { pool } from './db';
import { agentStorage } from './storage';

export type TaskStatus = 'running' | 'paused' | 'completed' | 'budget_exhausted' | 'failed';
export type SpendStatus = 'pending' | 'settled' | 'failed' | 'rejected';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export class BudgetError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'BudgetError';
  }
}

export interface BudgetState {
  total: number;
  spent: number;
  reserved: number;
  available: number;
  threshold: number;
  status: TaskStatus;
}

export interface SpendRow {
  id: number;
  vault: string;
  amountMicro: number;
  recipient: string | null;
  reason: string | null;
  txSignature: string | null;
  approvalId: number | null;
  status: SpendStatus;
  createdAt: string;
}

export interface ApprovalRow {
  id: number;
  vault: string;
  amountMicro: number;
  reason: string;
  recipient: string | null;
  status: ApprovalStatus;
  telegramMessageId: string | null;
  resolvedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface PreflightResult {
  status: 'approved' | 'awaiting_approval' | 'rejected' | 'exhausted';
  reservationId?: number;
  approvalId?: number;
  available?: number;
  reason?: string;
}

function requireDb() {
  if (!pool) throw new BudgetError('DB_UNAVAILABLE', 'Postgres not configured');
  return pool;
}

export async function getBudget(vault: string): Promise<BudgetState | null> {
  const db = requireDb();
  const { rows } = await db.query(
    `SELECT budget_total_micro, budget_spent_micro, budget_reserved_micro,
            approval_threshold_micro, task_status
     FROM agents WHERE vault = $1`,
    [vault],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  const total = Number(r.budget_total_micro || 0);
  const spent = Number(r.budget_spent_micro || 0);
  const reserved = Number(r.budget_reserved_micro || 0);
  return {
    total,
    spent,
    reserved,
    available: total - spent - reserved,
    threshold: Number(r.approval_threshold_micro || 0),
    status: (r.task_status || 'running') as TaskStatus,
  };
}

async function markExhausted(vault: string) {
  const db = requireDb();
  await db.query(
    `UPDATE agents SET task_status = 'budget_exhausted', updated_at = now() WHERE vault = $1`,
    [vault],
  );
  const cached = agentStorage.get(vault);
  if (cached) cached.taskStatus = 'budget_exhausted';
}

async function reserveInternal(vault: string, amountMicro: number): Promise<number> {
  const db = requireDb();
  // Atomic reserve via UPDATE...WHERE guards against races
  const { rowCount } = await db.query(
    `UPDATE agents
       SET budget_reserved_micro = budget_reserved_micro + $1,
           updated_at = now()
     WHERE vault = $2
       AND task_status = 'running'
       AND budget_total_micro - budget_spent_micro - budget_reserved_micro >= $1`,
    [amountMicro, vault],
  );
  if (rowCount === 0) {
    throw new BudgetError('BUDGET_EXHAUSTED', `Insufficient budget to reserve ${amountMicro} micro-USDC`);
  }
  // Write a pending spend row as the reservation receipt
  const { rows } = await db.query(
    `INSERT INTO agent_spends (vault, amount_micro, status)
     VALUES ($1, $2, 'pending')
     RETURNING id`,
    [vault, amountMicro],
  );
  return Number(rows[0].id);
}

async function releaseReservation(vault: string, amountMicro: number) {
  const db = requireDb();
  await db.query(
    `UPDATE agents
       SET budget_reserved_micro = GREATEST(0, budget_reserved_micro - $1),
           updated_at = now()
     WHERE vault = $2`,
    [amountMicro, vault],
  );
}

export async function preflight(
  vault: string,
  amountMicro: number,
  reason: string,
  recipient?: string,
): Promise<PreflightResult> {
  const db = requireDb();

  if (!Number.isFinite(amountMicro) || amountMicro <= 0) {
    throw new BudgetError('INVALID_AMOUNT', 'amount_micro must be positive');
  }

  const budget = await getBudget(vault);
  if (!budget) throw new BudgetError('AGENT_NOT_FOUND', vault);
  if (budget.status !== 'running') {
    throw new BudgetError('TASK_NOT_RUNNING', `Task status is ${budget.status}`);
  }
  if (amountMicro > budget.available) {
    await markExhausted(vault);
    throw new BudgetError(
      'BUDGET_EXHAUSTED',
      `Requested ${amountMicro} but only ${budget.available} available`,
    );
  }

  // Above threshold → create approval, wait for operator
  if (budget.threshold > 0 && amountMicro > budget.threshold) {
    const { rows } = await db.query(
      `INSERT INTO agent_approvals (vault, amount_micro, reason, recipient)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [vault, amountMicro, reason, recipient || null],
    );
    const approvalId = Number(rows[0].id);

    // Fire telegram notification best-effort
    try {
      await sendTelegramApprovalRequest(vault, approvalId, amountMicro, reason);
    } catch (err) {
      console.error('[spend-ledger] Telegram notify failed:', err);
    }

    return { status: 'awaiting_approval', approvalId };
  }

  // Under threshold → reserve immediately
  const reservationId = await reserveInternal(vault, amountMicro);
  return { status: 'approved', reservationId };
}

export async function settle(
  vault: string,
  reservationId: number,
  txSignature?: string,
  recipient?: string,
  reason?: string,
): Promise<void> {
  const db = requireDb();
  const { rows } = await db.query(
    `SELECT amount_micro, status, vault FROM agent_spends WHERE id = $1`,
    [reservationId],
  );
  if (rows.length === 0) {
    throw new BudgetError('RESERVATION_NOT_FOUND', `${reservationId}`);
  }
  const row = rows[0];
  if (row.vault !== vault) {
    throw new BudgetError('RESERVATION_MISMATCH', 'vault mismatch');
  }
  if (row.status !== 'pending') {
    throw new BudgetError('RESERVATION_NOT_PENDING', `status=${row.status}`);
  }
  const amount = Number(row.amount_micro);
  await db.query(
    `UPDATE agents
       SET budget_spent_micro = budget_spent_micro + $1,
           budget_reserved_micro = GREATEST(0, budget_reserved_micro - $1),
           updated_at = now()
     WHERE vault = $2`,
    [amount, vault],
  );
  await db.query(
    `UPDATE agent_spends
       SET status = 'settled', tx_signature = $1, recipient = COALESCE($2, recipient), reason = COALESCE($3, reason)
     WHERE id = $4`,
    [txSignature || null, recipient || null, reason || null, reservationId],
  );
}

export async function fail(
  vault: string,
  reservationId: number,
  errorReason: string,
): Promise<void> {
  const db = requireDb();
  const { rows } = await db.query(
    `SELECT amount_micro, status, vault FROM agent_spends WHERE id = $1`,
    [reservationId],
  );
  if (rows.length === 0) return;
  const row = rows[0];
  if (row.vault !== vault || row.status !== 'pending') return;
  const amount = Number(row.amount_micro);
  await releaseReservation(vault, amount);
  await db.query(
    `UPDATE agent_spends SET status = 'failed', reason = $1 WHERE id = $2`,
    [errorReason, reservationId],
  );
}

export async function getApproval(vault: string, approvalId: number): Promise<ApprovalRow | null> {
  const db = requireDb();
  const { rows } = await db.query(
    `SELECT * FROM agent_approvals WHERE id = $1 AND vault = $2`,
    [approvalId, vault],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    vault: r.vault,
    amountMicro: Number(r.amount_micro),
    reason: r.reason,
    recipient: r.recipient,
    status: r.status,
    telegramMessageId: r.telegram_message_id,
    resolvedBy: r.resolved_by,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

export async function resolveApproval(
  approvalId: number,
  decision: 'approved' | 'rejected',
  operatorUsername: string,
): Promise<ApprovalRow | null> {
  const db = requireDb();
  const { rows } = await db.query(
    `UPDATE agent_approvals
       SET status = $1, resolved_by = $2, resolved_at = now()
     WHERE id = $3 AND status = 'pending'
     RETURNING *`,
    [decision, operatorUsername, approvalId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  // If approved, reserve the budget now. If reserve fails (e.g. exhausted in the meantime),
  // flip the approval to rejected so the agent's poller sees the truth.
  if (decision === 'approved') {
    try {
      const reservationId = await reserveInternal(r.vault, Number(r.amount_micro));
      // Link the reservation back to the approval for auditability
      await db.query(
        `UPDATE agent_spends SET approval_id = $1 WHERE id = $2`,
        [approvalId, reservationId],
      );
    } catch (err) {
      await db.query(
        `UPDATE agent_approvals SET status = 'rejected', resolved_at = now() WHERE id = $1`,
        [approvalId],
      );
    }
  }
  const fresh = await getApproval(r.vault, approvalId);
  return fresh;
}

export async function listPendingApprovals(vault: string): Promise<ApprovalRow[]> {
  const db = requireDb();
  const { rows } = await db.query(
    `SELECT * FROM agent_approvals WHERE vault = $1 AND status = 'pending' ORDER BY created_at DESC`,
    [vault],
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    vault: r.vault,
    amountMicro: Number(r.amount_micro),
    reason: r.reason,
    recipient: r.recipient,
    status: r.status,
    telegramMessageId: r.telegram_message_id,
    resolvedBy: r.resolved_by,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  }));
}

export async function listSpends(vault: string, limit = 50): Promise<SpendRow[]> {
  const db = requireDb();
  const { rows } = await db.query(
    `SELECT * FROM agent_spends WHERE vault = $1 ORDER BY created_at DESC LIMIT $2`,
    [vault, limit],
  );
  return rows.map((r: any) => ({
    id: Number(r.id),
    vault: r.vault,
    amountMicro: Number(r.amount_micro),
    recipient: r.recipient,
    reason: r.reason,
    txSignature: r.tx_signature,
    approvalId: r.approval_id != null ? Number(r.approval_id) : null,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function setTaskStatus(vault: string, status: TaskStatus): Promise<void> {
  const db = requireDb();
  await db.query(
    `UPDATE agents SET task_status = $1, updated_at = now() WHERE vault = $2`,
    [status, vault],
  );
  const cached = agentStorage.get(vault);
  if (cached) cached.taskStatus = status;
}

// --- Telegram helper ----------------------------------------------------

async function fetchAgentTelegramConfig(vault: string): Promise<{
  botToken: string | null;
  operator: string | null;
}> {
  const db = requireDb();
  // telegram_bot_token is passed via ECS env var, not persisted today.
  // For v1 we read it from an ops-level fallback env var; a future
  // migration will persist per-agent bot tokens.
  const { rows } = await db.query(
    `SELECT operator_telegram FROM agents WHERE vault = $1`,
    [vault],
  );
  if (rows.length === 0) return { botToken: null, operator: null };
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || null,
    operator: rows[0].operator_telegram || null,
  };
}

export async function sendTelegramApprovalRequest(
  vault: string,
  approvalId: number,
  amountMicro: number,
  reason: string,
): Promise<void> {
  const { botToken, operator } = await fetchAgentTelegramConfig(vault);
  if (!botToken || !operator) {
    console.warn(`[spend-ledger] No telegram config for vault=${vault}, approval ${approvalId} will timeout`);
    return;
  }
  const amountUsdc = (amountMicro / 1_000_000).toFixed(2);
  const text =
    `Agent spend approval required\n\n` +
    `Amount: $${amountUsdc} USDC\n` +
    `Reason: ${reason}\n\n` +
    `Reply YES ${approvalId} to approve, NO ${approvalId} to reject.\n` +
    `Expires in 10 minutes.`;

  const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: operator, text }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Telegram sendMessage failed: ${resp.status} ${body.slice(0, 200)}`);
  }
  const json = (await resp.json()) as any;
  const messageId = json?.result?.message_id?.toString();
  if (messageId) {
    const db = requireDb();
    await db.query(
      `UPDATE agent_approvals SET telegram_message_id = $1 WHERE id = $2`,
      [messageId, approvalId],
    );
  }
}
