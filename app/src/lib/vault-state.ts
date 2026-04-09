// Helpers that turn raw vault state into a single human sentence + an action prompt.
// The page should explain itself in 1 line. No tables, no jargon.

export interface MinimalState {
  mood: string;
  hunger: string;
  balanceSol: number;
  balanceUsdc: number;
  daysAlive: number;
  minutesSinceActivity: number | null;
}

export interface VaultExplain {
  /** One-line headline that explains the current state to a stranger. */
  headline: string;
  /** Optional secondary line — gives context, only if it adds something. */
  detail?: string;
  /** What the visitor can do about it, if anything. */
  action?: 'feed' | 'wake' | 'chat' | 'wait';
  /** UI cue — emerald = good, amber = needs care, red = critical, neutral = nothing to do */
  tone: 'good' | 'caution' | 'critical' | 'neutral';
}

function fmtMinutes(min: number | null): string {
  if (min == null) return 'a while';
  if (min < 1) return 'just now';
  if (min < 60) return `${Math.floor(min)} minute${min < 2 ? '' : 's'}`;
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

  // Coma — the headline event. The single most important thing to convey.
  if (state.mood === 'coma' || state.hunger === 'coma') {
    return {
      headline: `${name} has run out of energy and gone dark.`,
      detail: `Send a little SOL to its wallet to wake it back up.`,
      action: 'feed',
      tone: 'critical',
    };
  }

  // Starving — about to go into coma
  if (state.hunger === 'starving') {
    return {
      headline: `${name} is fading. Almost no energy left.`,
      detail: `If nobody feeds it soon, it will fall into coma.`,
      action: 'feed',
      tone: 'critical',
    };
  }

  // Hungry — needs food but functional
  if (state.hunger === 'hungry') {
    return {
      headline: `${name} is hungry.`,
      detail: `It can still work, but it would appreciate a meal.`,
      action: 'feed',
      tone: 'caution',
    };
  }

  // Idle for a while — might want a chat
  if (state.minutesSinceActivity != null && state.minutesSinceActivity > 60 * 24) {
    return {
      headline: `${name} has been quiet for ${fmtMinutes(state.minutesSinceActivity)}.`,
      detail: `Maybe say hello.`,
      action: 'chat',
      tone: 'neutral',
    };
  }

  // Low fuel but not panicking
  if (state.hunger === 'low') {
    return {
      headline: `${name} is doing fine.`,
      detail: `Could use a top-up before its energy runs low.`,
      action: 'feed',
      tone: 'neutral',
    };
  }

  // Happy
  if (state.mood === 'happy') {
    return {
      headline: `${name} is thriving.`,
      detail: state.daysAlive < 1
        ? `It just got born today.`
        : `Earned today and feeling alive.`,
      tone: 'good',
    };
  }

  // Sad — different from hungry, this is engagement-driven
  if (state.mood === 'sad') {
    return {
      headline: `${name} seems quiet.`,
      detail: `Hasn't done much in a while. A nudge might help.`,
      action: 'chat',
      tone: 'caution',
    };
  }

  // Default: content
  return {
    headline: `${name} is doing fine.`,
    detail: state.daysAlive < 1
      ? `Born today. Still figuring things out.`
      : `${state.daysAlive} day${state.daysAlive === 1 ? '' : 's'} alive.`,
    tone: 'neutral',
  };
}
