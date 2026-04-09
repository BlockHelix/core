import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { RPC_URL } from '../config';
import { agentStorage } from './storage';
import { pool } from './db';

// USDC devnet mint used throughout the runtime
const USDC_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

export type Mood = 'happy' | 'content' | 'neutral' | 'anxious' | 'sad' | 'hungry' | 'starving' | 'coma';
export type Hunger = 'full' | 'low' | 'hungry' | 'starving' | 'coma';

export interface VaultState {
  mood: Mood;
  hunger: Hunger;
  level: number;
  title: string;
  balanceSol: number;
  balanceUsdc: number;
  revenueTotalMicro: number;
  revenueTodayMicro: number;
  spendsTodayCount: number;
  daysAlive: number;
  lastActivityAt: string | null;
  minutesSinceActivity: number | null;
  bornAt: string | null;
  emoji: string;
}

const LEVELS: Array<[number, string]> = [
  [0, 'Hatchling'],
  [1_000_000, 'Apprentice'],         // $1
  [10_000_000, 'Journeyman'],        // $10
  [100_000_000, 'Expert'],           // $100
  [1_000_000_000, 'Master'],         // $1k
  [10_000_000_000, 'Elder'],         // $10k
  [100_000_000_000, 'Mythic'],       // $100k
];

function levelFor(revenueMicro: number): { level: number; title: string } {
  let level = 1;
  let title = 'Hatchling';
  for (let i = 0; i < LEVELS.length; i++) {
    if (revenueMicro >= LEVELS[i][0]) {
      level = i + 1;
      title = LEVELS[i][1];
    }
  }
  return { level, title };
}

async function getUsdcBalance(connection: Connection, owner: PublicKey): Promise<number> {
  try {
    // Avoid @solana/spl-token (version conflicts with @solana/mpp). Use raw RPC.
    const resp = await connection.getParsedTokenAccountsByOwner(owner, {
      mint: USDC_DEVNET,
      programId: TOKEN_PROGRAM,
    });
    let total = 0;
    for (const acc of resp.value) {
      const info: any = acc.account.data;
      const amount = info?.parsed?.info?.tokenAmount?.uiAmount;
      if (typeof amount === 'number') total += amount;
    }
    return total;
  } catch {
    return 0;
  }
}

async function getSpendStats(vault: string): Promise<{ totalMicro: number; todayMicro: number; todayCount: number }> {
  if (!pool) return { totalMicro: 0, todayMicro: 0, todayCount: 0 };
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'settled' THEN amount_micro END), 0)::text AS total_micro,
       COALESCE(SUM(CASE WHEN status = 'settled' AND created_at > now() - interval '1 day' THEN amount_micro END), 0)::text AS today_micro,
       COUNT(*) FILTER (WHERE created_at > now() - interval '1 day')::text AS today_count,
       MAX(created_at) AS last_spend
     FROM agent_spends WHERE vault = $1`,
    [vault],
  );
  const r = rows[0] || {};
  return {
    totalMicro: Number(r.total_micro || 0),
    todayMicro: Number(r.today_micro || 0),
    todayCount: Number(r.today_count || 0),
  };
}

async function getLastActivity(vault: string): Promise<Date | null> {
  if (!pool) return null;
  const { rows } = await pool.query(
    `SELECT GREATEST(
       COALESCE((SELECT MAX(created_at) FROM agent_spends WHERE vault = $1), '1970-01-01'::timestamptz),
       COALESCE((SELECT MAX(created_at) FROM agent_approvals WHERE vault = $1), '1970-01-01'::timestamptz)
     ) AS last_at`,
    [vault],
  );
  const last = rows[0]?.last_at;
  if (!last) return null;
  const d = new Date(last);
  if (d.getFullYear() < 2000) return null;
  return d;
}

function moodFrom(params: {
  hunger: Hunger;
  revenueTodayMicro: number;
  minutesSinceActivity: number | null;
  daysAlive: number;
}): Mood {
  if (params.hunger === 'coma') return 'coma';
  if (params.hunger === 'starving') return 'sad';
  if (params.hunger === 'hungry') return 'anxious';

  // Engagement-aware mood — idle for a long time → drifting sad
  if (params.minutesSinceActivity != null && params.minutesSinceActivity > 60 * 48) return 'sad';
  if (params.minutesSinceActivity != null && params.minutesSinceActivity > 60 * 24) return 'neutral';

  if (params.revenueTodayMicro >= 1_000_000) return 'happy'; // earned $1+ today
  if (params.revenueTodayMicro > 0) return 'content';
  if (params.daysAlive < 1) return 'content';
  return 'neutral';
}

function hungerFrom(balanceSol: number): Hunger {
  // Thresholds based on rough tx cost (~0.00005 SOL/tx)
  // Coma = literally can't transact; starving = a few hours left
  if (balanceSol < 0.0001) return 'coma';
  if (balanceSol < 0.005) return 'starving';
  if (balanceSol < 0.05) return 'hungry';
  if (balanceSol < 0.5) return 'low';
  return 'full';
}

const EMOJI: Record<Mood, string> = {
  happy: '🔥',
  content: '🙂',
  neutral: '😐',
  anxious: '😬',
  sad: '😢',
  hungry: '🍽',
  starving: '💀',
  coma: '💤',
};

export async function getVaultState(vaultId: string): Promise<VaultState | null> {
  const agent = await agentStorage.getAsync(vaultId);
  if (!agent) return null;
  if (!agent.agentWallet) {
    return {
      mood: 'neutral',
      hunger: 'full',
      level: 1,
      title: 'Hatchling',
      balanceSol: 0,
      balanceUsdc: 0,
      revenueTotalMicro: 0,
      revenueTodayMicro: 0,
      spendsTodayCount: 0,
      daysAlive: 0,
      lastActivityAt: null,
      minutesSinceActivity: null,
      bornAt: new Date(agent.createdAt || Date.now()).toISOString(),
      emoji: EMOJI.neutral,
    };
  }

  const connection = new Connection(RPC_URL, 'confirmed');
  const owner = new PublicKey(agent.agentWallet);

  const [lamports, usdc, spendStats, lastActivity] = await Promise.all([
    connection.getBalance(owner).catch(() => 0),
    getUsdcBalance(connection, owner),
    getSpendStats(agent.vault),
    getLastActivity(agent.vault),
  ]);

  const balanceSol = lamports / LAMPORTS_PER_SOL;
  const bornAtMs = agent.createdAt || Date.now();
  const daysAlive = Math.max(0, (Date.now() - bornAtMs) / (1000 * 60 * 60 * 24));
  const minutesSinceActivity = lastActivity
    ? Math.max(0, (Date.now() - lastActivity.getTime()) / (1000 * 60))
    : null;

  const hunger = hungerFrom(balanceSol);
  const mood = moodFrom({
    hunger,
    revenueTodayMicro: spendStats.todayMicro, // proxy: activity today = mood today
    minutesSinceActivity,
    daysAlive,
  });
  const { level, title } = levelFor(spendStats.totalMicro);

  return {
    mood,
    hunger,
    level,
    title,
    balanceSol,
    balanceUsdc: usdc,
    revenueTotalMicro: spendStats.totalMicro,
    revenueTodayMicro: spendStats.todayMicro,
    spendsTodayCount: spendStats.todayCount,
    daysAlive: Math.floor(daysAlive),
    lastActivityAt: lastActivity ? lastActivity.toISOString() : null,
    minutesSinceActivity: minutesSinceActivity != null ? Math.floor(minutesSinceActivity) : null,
    bornAt: new Date(bornAtMs).toISOString(),
    emoji: EMOJI[mood],
  };
}
