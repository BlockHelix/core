// Helpers that turn raw vault state into a single human sentence + an action prompt.
// The page should explain itself in 1 line. No tables, no jargon.

export interface MinimalState {
  mood: string;
  level: number;
  jobsToday: number;
  chatsToday: number;
  daysAlive: number;
  minutesSinceActivity: number | null;
}

export interface VaultExplain {
  /** One-line headline that explains the current state to a stranger. */
  headline: string;
  /** Optional secondary line — gives context, only if it adds something. */
  detail?: string;
  /** What the visitor can do about it, if anything. */
  action?: 'chat' | 'wake' | 'wait';
  /** UI cue — emerald = good, amber = needs care, red = critical, neutral = nothing to do */
  tone: 'good' | 'caution' | 'critical' | 'neutral';
}

function fmtMinutes(min: number | null): string {
  if (min == null) return 'a while';
  if (min < 1) return 'just now';
  if (min < 60) return `${Math.floor(min)} minute${Math.floor(min) === 1 ? '' : 's'}`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  const d = Math.floor(min / 1440);
  return `${d} day${d === 1 ? '' : 's'}`;
}

export function explainVault(name: string, state: MinimalState | null): VaultExplain {
  if (!state) {
    return {
      headline: `${name} is loading…`,
      tone: 'neutral',
      action: 'wait',
    };
  }

  // Operator paused / completed
  if (state.mood === 'paused') {
    return {
      headline: `${name} is paused.`,
      detail: `Its operator stopped it. Nothing happening right now.`,
      tone: 'neutral',
    };
  }
  if (state.mood === 'completed') {
    return {
      headline: `${name} finished its work.`,
      detail: `Its operator marked the task complete.`,
      tone: 'neutral',
    };
  }

  // Recent errors → anxious
  if (state.mood === 'anxious') {
    return {
      headline: `${name} ran into trouble recently.`,
      detail: `A few of its actions failed in the last day. Watching to see if it recovers.`,
      tone: 'caution',
    };
  }

  // Long idle → sad
  if (state.mood === 'sad') {
    return {
      headline: `${name} has been quiet for ${fmtMinutes(state.minutesSinceActivity)}.`,
      detail: `Nobody has talked to it in a while.`,
      action: 'chat',
      tone: 'caution',
    };
  }

  // Mid idle → lonely
  if (state.mood === 'lonely') {
    return {
      headline: `${name} hasn't had a visitor today.`,
      detail: `Maybe say hello.`,
      action: 'chat',
      tone: 'neutral',
    };
  }

  // Active and earning attention
  if (state.mood === 'happy') {
    const total = state.jobsToday + state.chatsToday;
    return {
      headline: `${name} is busy today.`,
      detail: `${total} action${total === 1 ? '' : 's'} so far.`,
      tone: 'good',
    };
  }

  if (state.mood === 'content') {
    const total = state.jobsToday + state.chatsToday;
    return {
      headline: `${name} is doing fine.`,
      detail: total > 0
        ? `${total} action${total === 1 ? '' : 's'} today.`
        : state.daysAlive < 1
          ? `Born today. Still finding its feet.`
          : undefined,
      tone: 'neutral',
    };
  }

  // Default neutral
  return {
    headline: state.daysAlive < 1
      ? `${name} just woke up.`
      : `${name} is here.`,
    detail: state.daysAlive >= 1
      ? `${state.daysAlive} day${state.daysAlive === 1 ? '' : 's'} alive.`
      : undefined,
    action: 'chat',
    tone: 'neutral',
  };
}
