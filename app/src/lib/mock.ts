export interface MockAgent {
  id: string;
  name: string;
  description: string;
  authority: string;
  tvl: number;
  totalShares: number;
  totalRevenue: number;
  apy: number;
  status: 'active' | 'paused' | 'inactive';
  jobsCompleted: number;
  createdAt: Date;
}

export interface MockJobReceipt {
  id: string;
  agentId: string;
  jobType: string;
  revenue: number;
  timestamp: Date;
  txSignature: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface MockRevenueDataPoint {
  date: string;
  revenue: number;
}

export const MOCK_AGENTS: MockAgent[] = [
  {
    id: 'agent_defi_optimizer',
    name: 'DeFi Yield Optimizer',
    description: 'Automatically finds and compounds the best yield opportunities across Solana DeFi protocols. Rebalances positions based on market conditions.',
    authority: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    tvl: 285420.50,
    totalShares: 285420.5000,
    totalRevenue: 12847.32,
    apy: 18.42,
    status: 'active',
    jobsCompleted: 1247,
    createdAt: new Date('2025-12-15T08:23:00Z'),
  },
  {
    id: 'agent_nft_sweeper',
    name: 'NFT Floor Sweeper',
    description: 'Monitors NFT floor prices and executes strategic buys when price drops below threshold. Sells on recovery for consistent profits.',
    authority: 'C7dFWxF1Pd1w8kN9cKFvAFvZP3QNxMqpN7rRgRzPJkzM',
    tvl: 142800.00,
    totalShares: 142800.0000,
    totalRevenue: 8932.18,
    apy: 24.67,
    status: 'active',
    jobsCompleted: 834,
    createdAt: new Date('2025-12-20T14:45:00Z'),
  },
  {
    id: 'agent_mev_arbitrage',
    name: 'MEV Arbitrage Bot',
    description: 'Scans mempool for arbitrage opportunities across DEXs. Executes high-frequency trades to capture price discrepancies.',
    authority: 'A9pBqjW5xPjKV2nN8rQvR3tZxGhMkYwLp4fSdCeT1uXq',
    tvl: 512300.75,
    totalShares: 512300.7500,
    totalRevenue: 34210.88,
    apy: 31.25,
    status: 'active',
    jobsCompleted: 2891,
    createdAt: new Date('2025-11-28T19:12:00Z'),
  },
  {
    id: 'agent_liquidation_guardian',
    name: 'Liquidation Guardian',
    description: 'Monitors lending protocols for at-risk positions. Executes liquidations and captures liquidation bonuses while protecting DeFi stability.',
    authority: 'E4hK7vRtY9wPxNqM2gZsF6jD8cBaL5uTp3nWoQvX1rYz',
    tvl: 98750.00,
    totalShares: 98750.0000,
    totalRevenue: 4321.50,
    apy: 15.83,
    status: 'active',
    jobsCompleted: 567,
    createdAt: new Date('2026-01-05T11:30:00Z'),
  },
  {
    id: 'agent_bridge',
    name: 'Cross-Chain Bridge Agent',
    description: 'Facilitates token transfers across blockchains with optimized routing. Earns fees by providing liquidity and bridging services.',
    authority: 'F8mP3xQyW2nK9vL7tR4sD6cA1hJ5bN8eM9uG4pV2oZxW',
    tvl: 67200.25,
    totalShares: 67200.2500,
    totalRevenue: 2140.67,
    apy: 12.18,
    status: 'paused',
    jobsCompleted: 289,
    createdAt: new Date('2026-01-18T09:15:00Z'),
  },
  {
    id: 'agent_staking_compounder',
    name: 'Staking Compounder',
    description: 'Auto-compounds staking rewards across multiple validators. Optimizes delegation strategy for maximum yield and network health.',
    authority: 'B2nT5xR9wYpK3vL8sM6dC4fE1jH7gN9aQ3mW5kP8oVxU',
    tvl: 324100.80,
    totalShares: 324100.8000,
    totalRevenue: 15680.42,
    apy: 19.95,
    status: 'active',
    jobsCompleted: 1523,
    createdAt: new Date('2025-12-10T16:40:00Z'),
  },
];

export function getMockAgentById(id: string): MockAgent | undefined {
  return MOCK_AGENTS.find(agent => agent.id === id);
}

export function getMockAgents(): MockAgent[] {
  return MOCK_AGENTS;
}

const MOCK_JOB_RECEIPTS: MockJobReceipt[] = [
  { id: 'job_1', agentId: 'agent_defi_optimizer', jobType: 'Yield Rebalance', revenue: 145.32, timestamp: new Date('2026-02-03T14:22:00Z'), txSignature: '5xKJt9P2Wq8NxYvR7mZ3hL6sD4fG1jH8aQ9nC5bT2pXu', status: 'completed' },
  { id: 'job_2', agentId: 'agent_defi_optimizer', jobType: 'Compound Rewards', revenue: 89.54, timestamp: new Date('2026-02-03T08:15:00Z'), txSignature: '3mN8vL2Pq7Wx5Yt9Rz4Kh6Jd8Sf2Ga1Hb9Qn5Tc7Xp', status: 'completed' },
  { id: 'job_3', agentId: 'agent_defi_optimizer', jobType: 'Protocol Swap', revenue: 234.18, timestamp: new Date('2026-02-02T19:45:00Z'), txSignature: '7pQw4Xy9Lm2Nv8Rt5Kz3Jh6Gd1Sf8Ba9Hc2Tn7Xq5Wu', status: 'completed' },
  { id: 'job_4', agentId: 'agent_defi_optimizer', jobType: 'Yield Rebalance', revenue: 178.92, timestamp: new Date('2026-02-02T11:30:00Z'), txSignature: '2nT6Ry9Kp4Lw8Xv5Mz3Jh7Gd1Sf2Ba9Hc8Qx4Tp7Wu', status: 'completed' },
  { id: 'job_5', agentId: 'agent_defi_optimizer', jobType: 'Compound Rewards', revenue: 92.67, timestamp: new Date('2026-02-01T16:20:00Z'), txSignature: '8qW3Lv9Xp2Nt7Ry5Kz4Jh6Gd1Sf8Ba2Hc9Tm4Qx7Wu', status: 'completed' },

  { id: 'job_6', agentId: 'agent_nft_sweeper', jobType: 'Floor Sweep', revenue: 312.45, timestamp: new Date('2026-02-03T17:10:00Z'), txSignature: '4kH7Jd2Sf9Ba1Hc8Qx5Tp3Wu6Lv9Ry2Kz8Xp4Nt7Mz', status: 'completed' },
  { id: 'job_7', agentId: 'agent_nft_sweeper', jobType: 'Strategic Sale', revenue: 487.23, timestamp: new Date('2026-02-03T09:35:00Z'), txSignature: '9mT5Xp8Qw2Lv7Ry3Kz6Jh1Gd4Sf8Ba9Hc2Tn5Xu7Wp', status: 'completed' },
  { id: 'job_8', agentId: 'agent_nft_sweeper', jobType: 'Floor Sweep', revenue: 198.76, timestamp: new Date('2026-02-02T14:50:00Z'), txSignature: '6nY8Kz3Lv9Ry2Xp7Qw5Jh4Gd1Sf8Ba6Hc9Tm2Tp4Wu', status: 'completed' },
  { id: 'job_9', agentId: 'agent_nft_sweeper', jobType: 'Strategic Sale', revenue: 542.18, timestamp: new Date('2026-02-02T07:25:00Z'), txSignature: '3pX9Ry5Kz8Lv2Qw7Jh6Gd4Sf1Ba9Hc8Tn3Xp5Tm7Wu', status: 'completed' },
  { id: 'job_10', agentId: 'agent_nft_sweeper', jobType: 'Floor Monitor', revenue: 23.50, timestamp: new Date('2026-02-01T20:15:00Z'), txSignature: '7qL2Xp9Kz5Ry8Lv3Jh6Gd1Sf4Ba9Hc2Tn7Qw5Tp8Xu', status: 'completed' },

  { id: 'job_11', agentId: 'agent_mev_arbitrage', jobType: 'DEX Arbitrage', revenue: 1247.89, timestamp: new Date('2026-02-03T18:40:00Z'), txSignature: '5kP8Jd3Sf2Ba9Hc7Qx4Tp6Wu1Lv8Ry5Kz9Xp3Nt2Mz', status: 'completed' },
  { id: 'job_12', agentId: 'agent_mev_arbitrage', jobType: 'MEV Capture', revenue: 892.34, timestamp: new Date('2026-02-03T12:20:00Z'), txSignature: '2nR7Ky4Lp9Xw8Mv6Jz3Hh5Gd2Sf1Ba8Hc9Qx7Tp4Wu', status: 'completed' },
  { id: 'job_13', agentId: 'agent_mev_arbitrage', jobType: 'DEX Arbitrage', revenue: 1534.22, timestamp: new Date('2026-02-03T03:15:00Z'), txSignature: '9pQ4Lv2Xw7Nt5Ry8Kz3Jh6Gd1Sf9Ba2Hc4Tm8Qx3Wu', status: 'completed' },
  { id: 'job_14', agentId: 'agent_mev_arbitrage', jobType: 'Price Discrepancy', revenue: 678.45, timestamp: new Date('2026-02-02T21:45:00Z'), txSignature: '3mW8Xy5Lk9Pv2Rt7Kz4Jh6Gd1Sf3Ba9Hc8Tn5Xq2Tp', status: 'completed' },
  { id: 'job_15', agentId: 'agent_mev_arbitrage', jobType: 'MEV Capture', revenue: 1123.67, timestamp: new Date('2026-02-02T15:30:00Z'), txSignature: '7pL3Rv9Kz2Xw8Nt5Jh6Gd4Sf1Ba9Hc7Qx3Tm5Tp8Wu', status: 'completed' },

  { id: 'job_16', agentId: 'agent_liquidation_guardian', jobType: 'Liquidation', revenue: 287.92, timestamp: new Date('2026-02-03T13:55:00Z'), txSignature: '4kJ8Gd2Sf9Ba5Hc3Qx7Tp1Wu6Lv4Ry9Kz2Xp8Nt5Mz', status: 'completed' },
  { id: 'job_17', agentId: 'agent_liquidation_guardian', jobType: 'Risk Monitor', revenue: 45.30, timestamp: new Date('2026-02-03T06:40:00Z'), txSignature: '8mP5Xw9Lv2Ry7Kz3Qw6Jh1Gd4Sf8Ba9Hc2Tn5Xu7Wp', status: 'completed' },
  { id: 'job_18', agentId: 'agent_liquidation_guardian', jobType: 'Liquidation', revenue: 412.58, timestamp: new Date('2026-02-02T18:25:00Z'), txSignature: '6nX9Kz8Lv5Ry2Xp3Qw7Jh4Gd1Sf6Ba9Hc8Tm2Tp4Wu', status: 'completed' },
  { id: 'job_19', agentId: 'agent_liquidation_guardian', jobType: 'Position Check', revenue: 32.15, timestamp: new Date('2026-02-02T09:10:00Z'), txSignature: '3pY5Ry8Kz2Lv9Qw7Jh6Gd4Sf1Ba3Hc8Tn9Xp5Tm7Wu', status: 'completed' },
  { id: 'job_20', agentId: 'agent_liquidation_guardian', jobType: 'Liquidation', revenue: 325.77, timestamp: new Date('2026-02-01T22:50:00Z'), txSignature: '7qK2Xp5Kz9Ry8Lv3Jh6Gd1Sf4Ba2Hc9Tn7Qw5Tp8Xu', status: 'completed' },

  { id: 'job_21', agentId: 'agent_bridge', jobType: 'Bridge Transfer', revenue: 67.84, timestamp: new Date('2026-01-20T10:30:00Z'), txSignature: '5kL8Jd9Sf2Ba3Hc7Qx4Tp6Wu1Lv8Ry5Kz9Xp3Nt2Mz', status: 'completed' },
  { id: 'job_22', agentId: 'agent_bridge', jobType: 'Liquidity Provision', revenue: 123.45, timestamp: new Date('2026-01-19T14:15:00Z'), txSignature: '2nM7Ky4Lp9Xw8Mv6Jz3Hh5Gd2Sf1Ba8Hc9Qx7Tp4Wu', status: 'completed' },

  { id: 'job_23', agentId: 'agent_staking_compounder', jobType: 'Stake Compound', revenue: 234.56, timestamp: new Date('2026-02-03T15:45:00Z'), txSignature: '9pT4Lv2Xw7Nt5Ry8Kz3Jh6Gd1Sf9Ba2Hc4Tm8Qx3Wu', status: 'completed' },
  { id: 'job_24', agentId: 'agent_staking_compounder', jobType: 'Validator Switch', revenue: 187.23, timestamp: new Date('2026-02-03T08:30:00Z'), txSignature: '3mZ8Xy5Lk9Pv2Rt7Kz4Jh6Gd1Sf3Ba9Hc8Tn5Xq2Tp', status: 'completed' },
  { id: 'job_25', agentId: 'agent_staking_compounder', jobType: 'Stake Compound', revenue: 298.12, timestamp: new Date('2026-02-02T17:20:00Z'), txSignature: '7pN3Rv9Kz2Xw8Nt5Jh6Gd4Sf1Ba9Hc7Qx3Tm5Tp8Wu', status: 'completed' },
  { id: 'job_26', agentId: 'agent_staking_compounder', jobType: 'Reward Claim', revenue: 145.89, timestamp: new Date('2026-02-02T10:55:00Z'), txSignature: '4kR8Gd2Sf9Ba5Hc3Qx7Tp1Wu6Lv4Ry9Kz2Xp8Nt5Mz', status: 'completed' },
  { id: 'job_27', agentId: 'agent_staking_compounder', jobType: 'Stake Compound', revenue: 267.43, timestamp: new Date('2026-02-01T19:40:00Z'), txSignature: '8mQ5Xw9Lv2Ry7Kz3Qw6Jh1Gd4Sf8Ba9Hc2Tn5Xu7Wp', status: 'completed' },
];

export function getMockJobReceipts(agentId: string): MockJobReceipt[] {
  return MOCK_JOB_RECEIPTS.filter(receipt => receipt.agentId === agentId)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function getMockRevenueHistory(agentId: string): MockRevenueDataPoint[] {
  const agent = getMockAgentById(agentId);
  if (!agent) return [];

  const dataPoints: MockRevenueDataPoint[] = [];
  const today = new Date('2026-02-04');

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const baseRevenue = agent.totalRevenue / 30;
    const variance = (Math.random() - 0.5) * baseRevenue * 0.4;
    const revenue = Math.max(0, baseRevenue + variance);

    dataPoints.push({
      date: date.toISOString().split('T')[0],
      revenue: Math.round(revenue * 100) / 100,
    });
  }

  return dataPoints;
}
