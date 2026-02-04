'use client';

import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { usePrograms } from './usePrograms';
import { useWallets } from '@privy-io/react-auth/solana';

export interface UserPosition {
  vaultState: PublicKey;
  agentName: string;
  agentWallet: PublicKey;
  shareBalance: number;
  usdcValue: number;
  deposited: number;
}

export function useDashboardData() {
  const { vaultProgram, factoryProgram, connection } = usePrograms();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet || !vaultProgram || !factoryProgram) {
      setIsLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const userPubkey = new PublicKey(wallet.address);

        const depositRecords = await vaultProgram.account.depositRecord.all([
          {
            memcmp: {
              offset: 8 + 32,
              bytes: userPubkey.toBase58(),
            },
          },
        ]);

        const agentAccounts = await factoryProgram.account.agentMetadata.all();

        const positionsData = await Promise.all(
          depositRecords.map(async (record) => {
            const recordData = record.account as any;
            const vaultState = recordData.vault;

            const vaultData = await vaultProgram.account.vaultState.fetch(vaultState);
            const shareMint = (vaultData as any).shareMint;

            const agent = agentAccounts.find(
              (a) => (a.account as any).vault.toString() === vaultState.toString()
            );

            try {
              const userShareAccount = await getAssociatedTokenAddress(
                shareMint,
                userPubkey
              );

              const shareBalanceInfo = await connection.getTokenAccountBalance(userShareAccount);
              const balance = parseFloat(shareBalanceInfo.value.amount) / 1_000_000;

              const vaultUsdcAccountInfo = await connection.getTokenAccountBalance((vaultData as any).vaultUsdcAccount);
              const totalAssets = parseFloat(vaultUsdcAccountInfo.value.amount) / 1_000_000;
              const shareMintInfo = await connection.getTokenSupply(shareMint);
              const totalShares = parseFloat(shareMintInfo.value.amount) / 1_000_000;
              const sharePrice = totalShares > 0 ? totalAssets / totalShares : 1;
              const usdcValue = balance * sharePrice;

              return {
                vaultState,
                agentName: agent ? (agent.account as any).name : 'Unknown Agent',
                agentWallet: (vaultData as any).agentWallet,
                shareBalance: balance,
                usdcValue,
                deposited: Number(recordData.totalDeposited) / 1_000_000,
              };
            } catch {
              return null;
            }
          })
        );

        setPositions(positionsData.filter((p) => p !== null) as UserPosition[]);
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, [wallet, vaultProgram, factoryProgram, connection]);

  return { positions, isLoading, error };
}
