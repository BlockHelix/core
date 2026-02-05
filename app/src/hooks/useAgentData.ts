'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { usePrograms } from './usePrograms';
import { findVaultState, findRegistryState } from '@/lib/pda';

export interface AgentMetadata {
  factory: PublicKey;
  agentWallet: PublicKey;
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
}

export interface VaultState {
  agentWallet: PublicKey;
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
  agentWallet: PublicKey;
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
  const { factoryProgram, vaultProgram } = usePrograms();
  const [agents, setAgents] = useState<AgentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    if (!factoryProgram || !vaultProgram) {
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
        const vaultInfos = await vaultProgram.account.vaultState.fetchMultiple(vaultPubkeys);

        const agentsData = agentAccounts.map((a, i) => {
          const account = a.account as any;
          const vaultData = vaultInfos[i] as any;
          return {
            ...account,
            totalRevenue: vaultData?.totalRevenue ?? 0,
            totalJobs: vaultData?.totalJobs ?? 0,
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
  }, [factoryProgram, vaultProgram]);

  return { agents, isLoading, error };
}

export function useAgentDetails(agentWallet: PublicKey | null) {
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
    if (!agentWallet || !factoryProgram || !vaultProgram || !registryProgram) {
      setIsLoading(false);
      return;
    }

    const walletKey = agentWallet.toString();
    if (fetchedRef.current === walletKey) return;

    const fetchAgentData = async () => {
      try {
        fetchedRef.current = walletKey;
        const [vault] = findVaultState(agentWallet);
        const [registry] = findRegistryState(vault);

        const [agentAccounts, vaultData, registryData] = await Promise.all([
          factoryProgram.account.agentMetadata.all(),
          vaultProgram.account.vaultState.fetch(vault),
          registryProgram.account.registryState.fetch(registry),
        ]);

        const agent = agentAccounts.find(
          (a) => (a.account as any).agentWallet.toString() === agentWallet.toString()
        );
        if (agent) {
          setAgentMetadata(agent.account as any);
        }

        const [vaultUsdcAccountInfo, shareMintInfo] = await Promise.all([
          connection.getTokenAccountBalance((vaultData as any).vaultUsdcAccount),
          connection.getTokenSupply((vaultData as any).shareMint),
        ]);

        const assets = parseFloat(vaultUsdcAccountInfo.value.amount) / 1_000_000;
        const shares = parseFloat(shareMintInfo.value.amount) / 1_000_000;

        setVaultState(vaultData as any);
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
  }, [agentWallet, factoryProgram, vaultProgram, registryProgram, connection]);

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

        const data = receiptAccounts.map((r) => r.account as any);
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
