'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { usePrograms } from './usePrograms';
import { findRegistryState } from '@/lib/pda';

export interface AgentMetadata {
  factory: PublicKey;
  operator: PublicKey;
  vault: PublicKey;
  registry: PublicKey;
  shareMint: PublicKey;
  name: string;
  githubHandle: string;
  endpointUrl: string;
  agentId: number;
  createdAt: number;
  isActive: boolean;
  totalRevenue?: number;
  totalJobs?: number;
  operatorBond?: number;
  totalSlashed?: number;
  slashEvents?: number;
  totalDeposited?: number;
  totalWithdrawn?: number;
  totalResolvedAgainst?: number;
}

export interface VaultState {
  operator: PublicKey;
  usdcMint: PublicKey;
  shareMint: PublicKey;
  vaultUsdcAccount: PublicKey;
  agentFeeBps: number;
  protocolFeeBps: number;
  protocolTreasury: PublicKey;
  totalRevenue: number;
  totalJobs: number;
  createdAt: number;
  operatorBond: number;
  totalSlashed: number;
  slashEvents: number;
  maxTvl: number;
  totalDeposited: number;
  totalWithdrawn: number;
  deployedCapital: number;
  yieldEarned: number;
  virtualShares: number;
  virtualAssets: number;
  lockupEpochs: number;
  epochLength: number;
  navHighWaterMark: number;
  paused: boolean;
}

export interface RegistryState {
  vault: PublicKey;
  operator: PublicKey;
  protocolAuthority: PublicKey;
  jobCounter: number;
  challengeWindow: number;
  totalChallenged: number;
  totalResolvedAgainst: number;
}

export interface JobReceipt {
  registry: PublicKey;
  jobId: number;
  client: PublicKey;
  artifactHash: number[];
  paymentAmount: number;
  paymentTx: number[];
  status: any;
  createdAt: number;
  challengedAt: number;
  resolvedAt: number;
  challenger: PublicKey;
}

function toNum(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toNumber === 'function') return v.toNumber();
  return Number(v);
}

const CACHE_TTL = 30_000;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T) {
  cache.set(key, { data, timestamp: Date.now() });
}

export function useAgentList() {
  const { factoryProgram, vaultProgram, registryProgram } = usePrograms();
  const [agents, setAgents] = useState<AgentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    if (!factoryProgram || !vaultProgram || !registryProgram) {
      setIsLoading(false);
      return;
    }

    const fetchAgents = async () => {
      const cached = getCached<AgentMetadata[]>('agentList');
      if (cached) {
        setAgents(cached);
        setIsLoading(false);
        return;
      }

      try {
        fetchedRef.current = true;
        const agentAccounts = await factoryProgram.account.agentMetadata.all();

        if (agentAccounts.length === 0) {
          setAgents([]);
          setCache('agentList', []);
          return;
        }

        const vaultPubkeys = agentAccounts.map((a) => (a.account as any).vault as PublicKey);
        const registryPubkeys = vaultPubkeys.map((v) => findRegistryState(v)[0]);

        const [vaultInfos, registryInfos] = await Promise.all([
          vaultProgram.account.vaultState.fetchMultiple(vaultPubkeys),
          registryProgram.account.registryState.fetchMultiple(registryPubkeys),
        ]);

        const agentsData = agentAccounts.map((a, i) => {
          const account = a.account as any;
          const v = vaultInfos[i] as any;
          const r = registryInfos[i] as any;
          return {
            ...account,
            createdAt: v?.createdAt ?? account.createdAt ?? 0,
            totalRevenue: v?.totalRevenue ?? 0,
            totalJobs: v?.totalJobs ?? 0,
            operatorBond: v?.operatorBond ?? 0,
            totalSlashed: v?.totalSlashed ?? 0,
            slashEvents: v?.slashEvents ?? 0,
            totalDeposited: v?.totalDeposited ?? 0,
            totalWithdrawn: v?.totalWithdrawn ?? 0,
            totalResolvedAgainst: r?.totalResolvedAgainst ?? 0,
          };
        });

        setAgents(agentsData);
        setCache('agentList', agentsData);
      } catch (err: any) {
        const msg = err?.message || 'Failed to fetch agents';
        if (msg.includes('Account does not exist')) {
          setAgents([]);
        } else {
          setError(msg);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgents();
  }, [factoryProgram, vaultProgram, registryProgram]);

  return { agents, isLoading, error };
}

export function useAgentDetails(agentKey: PublicKey | null) {
  const { factoryProgram, vaultProgram, registryProgram, connection } = usePrograms();
  const [agentMetadata, setAgentMetadata] = useState<AgentMetadata | null>(null);
  const [vaultState, setVaultState] = useState<VaultState | null>(null);
  const [registryState, setRegistryState] = useState<RegistryState | null>(null);
  const [totalAssets, setTotalAssets] = useState<number>(0);
  const [totalShares, setTotalShares] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!agentKey || !factoryProgram || !vaultProgram || !registryProgram) {
      setIsLoading(false);
      return;
    }

    const keyStr = agentKey.toString();
    if (fetchedRef.current === keyStr) return;

    const fetchAgentData = async () => {
      try {
        fetchedRef.current = keyStr;

        const agentAccounts = await factoryProgram.account.agentMetadata.all();
        const agent = agentAccounts.find((a) => {
          const acct = a.account as any;
          return acct.vault?.toString() === keyStr || acct.agentWallet?.toString() === keyStr;
        });

        if (!agent) {
          setError('Agent not found on-chain.');
          return;
        }

        const am = agent.account as any;
        const vault = am.vault as PublicKey;
        const [registry] = findRegistryState(vault);

        setAgentMetadata({
          ...am,
          agentId: toNum(am.agentId),
          createdAt: toNum(am.createdAt),
        });

        const [vaultData, registryData] = await Promise.all([
          vaultProgram.account.vaultState.fetch(vault),
          registryProgram.account.registryState.fetch(registry),
        ]);

        const [vaultUsdcAccountInfo, shareMintInfo] = await Promise.all([
          connection.getTokenAccountBalance((vaultData as any).vaultUsdcAccount),
          connection.getTokenSupply((vaultData as any).shareMint),
        ]);

        const assets = parseFloat(vaultUsdcAccountInfo.value.amount) / 1_000_000;
        const shares = parseFloat(shareMintInfo.value.amount) / 1_000_000;

        const vd = vaultData as any;
        setVaultState({
          ...vd,
          agentFeeBps: toNum(vd.agentFeeBps),
          protocolFeeBps: toNum(vd.protocolFeeBps),
          totalRevenue: toNum(vd.totalRevenue),
          totalJobs: toNum(vd.totalJobs),
          createdAt: toNum(vd.createdAt),
          operatorBond: toNum(vd.operatorBond),
          totalSlashed: toNum(vd.totalSlashed),
          slashEvents: toNum(vd.slashEvents),
          maxTvl: toNum(vd.maxTvl),
          totalDeposited: toNum(vd.totalDeposited),
          totalWithdrawn: toNum(vd.totalWithdrawn),
          deployedCapital: toNum(vd.deployedCapital),
          yieldEarned: toNum(vd.yieldEarned),
          virtualShares: toNum(vd.virtualShares),
          virtualAssets: toNum(vd.virtualAssets),
          lockupEpochs: toNum(vd.lockupEpochs),
          epochLength: toNum(vd.epochLength),
          navHighWaterMark: toNum(vd.navHighWaterMark),
        });
        setRegistryState(registryData as any);
        setTotalAssets(assets);
        setTotalShares(shares);
      } catch (err: any) {
        const msg = err?.message || 'Failed to fetch agent data';
        if (msg.includes('Account does not exist')) {
          setError('Agent not found on-chain. It may not be deployed yet.');
        } else {
          setError(msg);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgentData();
  }, [agentKey, factoryProgram, vaultProgram, registryProgram, connection]);

  return { agentMetadata, vaultState, registryState, totalAssets, totalShares, isLoading, error };
}

export function useJobReceipts(registryState: PublicKey | null) {
  const { registryProgram } = usePrograms();
  const [receipts, setReceipts] = useState<JobReceipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!registryState || !registryProgram) {
      setIsLoading(false);
      return;
    }

    const key = registryState.toString();
    if (fetchedRef.current === key) return;

    const fetchReceipts = async () => {
      const cacheKey = `receipts:${key}`;
      const cached = getCached<JobReceipt[]>(cacheKey);
      if (cached) {
        setReceipts(cached);
        setIsLoading(false);
        return;
      }

      try {
        fetchedRef.current = key;
        const receiptAccounts = await registryProgram.account.jobReceipt.all([
          {
            memcmp: {
              offset: 8,
              bytes: registryState.toBase58(),
            },
          },
        ]);

        const data = receiptAccounts.map((r) => {
          const a = r.account as any;
          return {
            ...a,
            jobId: toNum(a.jobId),
            paymentAmount: toNum(a.paymentAmount),
            createdAt: toNum(a.createdAt),
            challengedAt: toNum(a.challengedAt),
            resolvedAt: toNum(a.resolvedAt),
          };
        });
        setReceipts(data);
        setCache(cacheKey, data);
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch receipts');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReceipts();
  }, [registryState, registryProgram]);

  return { receipts, isLoading, error };
}
