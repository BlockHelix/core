'use client';

import { useState, useEffect } from 'react';
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

export function useAgentList() {
  const { factoryProgram } = usePrograms();
  const [agents, setAgents] = useState<AgentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      if (!factoryProgram) {
        setIsLoading(false);
        return;
      }

      try {
        const agentAccounts = await factoryProgram.account.agentMetadata.all();
        setAgents(agentAccounts.map((a) => a.account as any));
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch agents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgents();
  }, [factoryProgram]);

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

  useEffect(() => {
    if (!agentWallet || !factoryProgram || !vaultProgram || !registryProgram) {
      setIsLoading(false);
      return;
    }

    const fetchAgentData = async () => {
      try {
        const [vault] = findVaultState(agentWallet);
        const [registry] = findRegistryState(vault);

        const agentAccounts = await factoryProgram.account.agentMetadata.all();
        const agent = agentAccounts.find(
          (a) => a.account.agentWallet.toString() === agentWallet.toString()
        );

        if (!agent) {
          throw new Error('Agent not found');
        }

        const vaultData = await vaultProgram.account.vaultState.fetch(vault);
        const registryData = await registryProgram.account.registryState.fetch(registry);

        const vaultUsdcAccountInfo = await connection.getTokenAccountBalance(vaultData.vaultUsdcAccount);
        const shareMintInfo = await connection.getTokenSupply(vaultData.shareMint);

        setAgentMetadata(agent.account as any);
        setVaultState(vaultData as any);
        setRegistryState(registryData as any);
        setTotalAssets(parseFloat(vaultUsdcAccountInfo.value.amount) / 1_000_000);
        setTotalShares(parseFloat(shareMintInfo.value.amount) / 1_000_000);
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch agent data');
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

  useEffect(() => {
    if (!registryState || !registryProgram) {
      setIsLoading(false);
      return;
    }

    const fetchReceipts = async () => {
      try {
        const receiptAccounts = await registryProgram.account.jobReceipt.all([
          {
            memcmp: {
              offset: 8,
              bytes: registryState.toBase58(),
            },
          },
        ]);

        setReceipts(receiptAccounts.map((r) => r.account as any));
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
