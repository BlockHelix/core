import { agentStorage } from './storage';
import { pool } from './db';

// Mood is purely activity-driven. The vault is "alive" as long as the operator's
// subscription is active. Hunger / coma / wallet-as-life-support is gone — that
// was a leaky engineering metaphor. The agent runs on the operator's Anthropic
// key + a platform-sponsored runtime; gas is irrelevant to the user.

export type Mood = 'happy' | 'content' | 'neutral' | 'lonely' | 'sad' | 'anxious' | 'paused' | 'completed';

export interface VaultState {
  mood: Mood;
  level: number;
  title: string;
  jobsTotal: number;
  jobsToday: number;
  chatsTotal: number;
  chatsToday: number;
  daysAlive: number;
  lastActivityAt: string | null;
  minutesSinceActivity: number | null;
  bornAt: string | null;
  emoji: string;
}

const LEVELS: Array<[number, string]> = [
  [0, 'Hatchling'],
  [10, 'Apprentice'],
  [50, 'Journeyman'],
  [200, 'Expert'],
  [1000, 'Master'],
  [5000, 'Elder'],
  [25000, 'Mythic'],
];

function levelFor(activityCount: number): { level: number; title: string } {
  let level = 1;
  let title = 'Hatchling';
  for (let i = 0; i < LEVELS.length; i++) {
    if (activityCount >= LEVELS[i][0]) {
      level = i + 1;
      title = LEVELS[i][1];
    }
  }
  return { level, title };
}

interface ActivityStats {
  jobsTotal: number;
  jobsToday: number;
  chatsTotal: number;
  chatsToday: number;
  lastActivity: Date | null;
  errorsRecent: number;
}

async function getActivityStats(vault: string): Promise<ActivityStats> {
  if (!pool) return { jobsTotal: 0, jobsToday: 0, chatsTotal: 0, chatsToday: 0, lastActivity: null, errorsRecent: 0 };

  // Use existing tables only — no new schema yet. Job + chat counts come from
  // job_receipts (already populated by event indexer) and agent_spends
  // (any settled action the agent did).
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM job_receipts WHERE vault = $1)::int AS jobs_total,
       (SELECT COUNT(*) FROM job_receipts WHERE vault = $1 AND created_at > now() - interval '1 day')::int AS jobs_today,
       (SELECT COUNT(*) FROM agent_spends WHERE vault = $1 AND status = 'settled')::int AS chats_total,
       (SELECT COUNT(*) FROM agent_spends WHERE vault = $1 AND status = 'settled' AND created_at > now() - interval '1 day')::int AS chats_today,
       (SELECT COUNT(*) FROM agent_spends WHERE vault = $1 AND status = 'failed' AND created_at > now() - interval '1 day')::int AS errors_recent,
       GREATEST(
         COALESCE((SELECT MAX(created_at) FROM job_receipts WHERE vault = $1), '1970-01-01'::timestamptz),
         COALESCE((SELECT MAX(created_at) FROM agent_spends WHERE vault = $1), '1970-01-01'::timestamptz)
       ) AS last_activity`,
    [vault],
  );
  const r = rows[0] || {};
  let last: Date | null = null;
  if (r.last_activity) {
    const d = new Date(r.last_activity);
    if (d.getFullYear() >= 2000) last = d;
  }
  return {
    jobsTotal: Number(r.jobs_total || 0),
    jobsToday: Number(r.jobs_today || 0),
    chatsTotal: Number(r.chats_total || 0),
    chatsToday: Number(r.chats_today || 0),
    errorsRecent: Number(r.errors_recent || 0),
    lastActivity: last,
  };
}

function moodFrom(params: {
  taskStatus: string;
  jobsToday: number;
  chatsToday: number;
  errorsRecent: number;
  minutesSinceActivity: number | null;
  daysAlive: number;
}): Mood {
  // Operator-controlled states win
  if (params.taskStatus === 'paused') return 'paused';
  if (params.taskStatus === 'completed') return 'completed';

  // Errors recently → anxious
  if (params.errorsRecent >= 3) return 'anxious';

  // Activity-driven
  const totalToday = params.jobsToday + params.chatsToday;
  if (totalToday >= 10) return 'happy';
  if (totalToday >= 1) return 'content';

  // Idle states — measured in hours since last activity
  if (params.minutesSinceActivity != null) {
    const hoursIdle = params.minutesSinceActivity / 60;
    if (hoursIdle > 96) return 'sad';      // 4+ days quiet
    if (hoursIdle > 24) return 'lonely';   // a day quiet
  }

  // Brand new — give it a moment
  if (params.daysAlive < 1) return 'content';

  return 'neutral';
}

const EMOJI: Record<Mood, string> = {
  happy: '✦',
  content: '◉',
  neutral: '○',
  lonely: '◐',
  sad: '◑',
  anxious: '◍',
  paused: '◊',
  completed: '✓',
};

export async function getVaultState(vaultId: string): Promise<VaultState | null> {
  const agent = await agentStorage.getAsync(vaultId);
  if (!agent) return null;

  const stats = await getActivityStats(agent.vault);
  const bornAtMs = agent.createdAt || Date.now();
  const daysAlive = Math.max(0, (Date.now() - bornAtMs) / (1000 * 60 * 60 * 24));
  const minutesSinceActivity = stats.lastActivity
    ? Math.max(0, (Date.now() - stats.lastActivity.getTime()) / (1000 * 60))
    : null;

  const taskStatus = agent.taskStatus || 'running';
  const mood = moodFrom({
    taskStatus,
    jobsToday: stats.jobsToday,
    chatsToday: stats.chatsToday,
    errorsRecent: stats.errorsRecent,
    minutesSinceActivity,
    daysAlive,
  });

  // Level: based on cumulative meaningful activity (jobs + chats)
  const totalActivity = stats.jobsTotal + stats.chatsTotal;
  const { level, title } = levelFor(totalActivity);

  return {
    mood,
    level,
    title,
    jobsTotal: stats.jobsTotal,
    jobsToday: stats.jobsToday,
    chatsTotal: stats.chatsTotal,
    chatsToday: stats.chatsToday,
    daysAlive: Math.floor(daysAlive),
    lastActivityAt: stats.lastActivity ? stats.lastActivity.toISOString() : null,
    minutesSinceActivity: minutesSinceActivity != null ? Math.floor(minutesSinceActivity) : null,
    bornAt: new Date(bornAtMs).toISOString(),
    emoji: EMOJI[mood],
  };
}
