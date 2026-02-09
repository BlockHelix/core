export type Tier = 'S' | 'A' | 'B' | 'C' | 'D';

const MAX_TVL = 1_000_000_000_000; // 1B micro-USDC = $1M
const TARGET_APY = 0.20;

export interface VaultMetrics {
  tvl: number;
  totalRevenue: number;
  totalJobs: number;
  operatorBond: number;
  totalSlashed: number;
  slashEvents: number;
  createdAt: number;
}

export function reputationScore(v: VaultMetrics, now: number = Date.now() / 1000): number {
  const ageDays = Math.max((now - v.createdAt) / 86400, 0);
  const ageYears = Math.max(ageDays / 365, 0.01);

  const tvlScore = v.tvl > 0 ? Math.log10(v.tvl + 1) / Math.log10(MAX_TVL) : 0;

  const revenueRate = v.tvl > 0 ? v.totalRevenue / v.tvl / ageYears : 0;
  const revenueScore = Math.min(revenueRate / TARGET_APY, 1.0);

  const jobsScore = 1 - Math.exp(-v.totalJobs / 100);
  const ageScore = Math.min(ageDays / 365, 1.0);
  const bondScore = v.tvl > 0 ? Math.min(v.operatorBond / v.tvl, 0.2) * 5 : 0;

  const slashRatio = (v.totalRevenue + v.tvl) > 0
    ? v.totalSlashed / (v.totalRevenue + v.tvl)
    : 0;
  const slashPenalty = slashRatio * 2.0;

  const successRate = v.totalJobs > 0
    ? 1 - (v.slashEvents / v.totalJobs)
    : 0.5;
  const successMult = 0.5 + successRate * 0.5;

  const raw = (
    tvlScore * 0.35 +
    revenueScore * 0.25 +
    jobsScore * 0.15 +
    ageScore * 0.15 +
    bondScore * 0.10 -
    slashPenalty
  );

  return Math.max(0, Math.min(1, raw * successMult));
}

export function getTier(score: number): Tier {
  if (score >= 0.8) return 'S';
  if (score >= 0.6) return 'A';
  if (score >= 0.4) return 'B';
  if (score >= 0.2) return 'C';
  return 'D';
}

export const TIER_COLORS: Record<Tier, string> = {
  S: 'text-amber-400 border-amber-400/40 bg-amber-400/10',
  A: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  B: 'text-cyan-400 border-cyan-400/40 bg-cyan-400/10',
  C: 'text-white/60 border-white/20 bg-white/5',
  D: 'text-white/40 border-white/10 bg-white/[0.02]',
};

export const TIER_LABELS: Record<Tier, string> = {
  S: 'Elite',
  A: 'Established',
  B: 'Growing',
  C: 'New',
  D: 'Unproven',
};

