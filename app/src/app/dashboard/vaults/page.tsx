import VaultList from '@/components/vaults/VaultList';

export const metadata = { title: 'Vaults | BlockHelix' };

export default function VaultsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-white">Vaults</h2>
        <p className="mt-1.5 max-w-xl text-sm text-white/50 leading-relaxed">
          Vault creation is one endpoint on the BlockHelix API. Deploy and track ERC-4626 vaults on
          Base here, or call{' '}
          <code className="font-data text-white/70">POST /v1/vaults</code> directly with an API key.
        </p>
      </div>
      <VaultList />
    </div>
  );
}
