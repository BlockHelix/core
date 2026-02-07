'use client';

import { useState, useEffect, useRef } from 'react';
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
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    if (!wallet || !vaultProgram || !factoryProgram) {
      setIsLoading(false);
      return;
    }

    const fetchDashboardData = async () => {
      try {
        fetchedRef.current = true;
        const userPubkey = new PublicKey(wallet.address);

        const [depositRecords, agentAccounts] = await Promise.all([
          vaultProgram.account.DepositRecord.all([
            {
              memcmp: {
                offset: 8 + 32,
                bytes: userPubkey.toBase58(),
              },
            },
          ]),
          factoryProgram.account.AgentMetadata.all(),
        ]);

        if (depositRecords.length === 0) {
          setPositions([]);
          return;
        }

        const vaultPubkeys = depositRecords.map((r) => (r.account as any).vault as PublicKey);
        const vaultInfos = await vaultProgram.account.VaultState.fetchMultiple(vaultPubkeys);

        const positionsData = await Promise.all(
          depositRecords.map(async (record, i) => {
            const recordData = record.account as any;
            const vaultData = vaultInfos[i] as any;
            if (!vaultData) return null;

            const agent = agentAccounts.find(
              (a) => (a.account as any).vault.toString() === vaultPubkeys[i].toString()
            );

            try {
              const userShareAccount = await getAssociatedTokenAddress(
                vaultData.share_mint,
                userPubkey
              );

              const [shareBalanceInfo, vaultUsdcInfo, shareMintInfo] = await Promise.all([
                connection.getTokenAccountBalance(userShareAccount),
                connection.getTokenAccountBalance(vaultData.vault_usdc_account),
                connection.getTokenSupply(vaultData.share_mint),
              ]);

              const balance = parseFloat(shareBalanceInfo.value.amount) / 1_000_000;
              const totalAssets = parseFloat(vaultUsdcInfo.value.amount) / 1_000_000;
              const totalShares = parseFloat(shareMintInfo.value.amount) / 1_000_000;
              const sharePrice = totalShares > 0 ? totalAssets / totalShares : 1;

              return {
                vaultState: vaultPubkeys[i],
                agentName: agent ? (agent.account as any).name : 'Unknown Agent',
                agentWallet: vaultData.agent_wallet,
                shareBalance: balance,
                usdcValue: balance * sharePrice,
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
