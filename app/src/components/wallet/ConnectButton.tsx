'use client';

import { useAppKit, useAppKitAccount, useAppKitNetwork, useDisconnect } from '@reown/appkit/react';
import { clsx } from 'clsx';
import { truncateAddress } from '@/lib/format';
import { BASE_CHAIN_ID } from '@/lib/vault-types';

// Custom connect control (rather than the <appkit-button> web component) so it
// matches the dashboard's button styling and avoids custom-element JSX typing.
export default function ConnectButton() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { chainId, switchNetwork } = useAppKitNetwork();
  const { disconnect } = useDisconnect();

  if (!isConnected || !address) {
    return (
      <button
        type="button"
        onClick={() => open()}
        className="bh-btn-primary rounded-lg px-4 py-2 text-[11px] font-medium uppercase tracking-wider-2"
      >
        Connect Wallet
      </button>
    );
  }

  const wrongChain = chainId !== undefined && Number(chainId) !== BASE_CHAIN_ID;

  return (
    <div className="flex items-center gap-2">
      {wrongChain && (
        <button
          type="button"
          onClick={() => switchNetwork({ id: BASE_CHAIN_ID } as never)}
          className="rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-[11px] font-medium uppercase tracking-wider-2 text-amber-700 transition-colors hover:bg-amber-100"
        >
          Switch to Base
        </button>
      )}
      <button
        type="button"
        onClick={() => open()}
        className={clsx(
          'rounded-lg border px-3 py-2 font-data text-xs transition-colors',
          wrongChain
            ? 'border-amber-500/40 text-amber-700'
            : 'border-black/[0.1] text-zinc-700 hover:bg-black/[0.03]',
        )}
        title="Manage connection"
      >
        <span className="inline-flex items-center gap-2">
          <span className={clsx('h-1.5 w-1.5 rounded-full', wrongChain ? 'bg-amber-500' : 'bg-[#10c689]')} />
          {truncateAddress(address, 4)}
        </span>
      </button>
      <button
        type="button"
        onClick={() => disconnect()}
        className="text-[11px] font-medium uppercase tracking-wider-2 text-zinc-400 transition-colors hover:text-zinc-700"
      >
        Disconnect
      </button>
    </div>
  );
}
