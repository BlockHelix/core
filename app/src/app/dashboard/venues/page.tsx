import VenueAuditTable from '@/components/venues/VenueAuditTable';

export const metadata = { title: 'Venue Audit | BlockHelix' };

export default function VenuesPage() {
  return (
    <div className="min-w-0">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Venue audit</h2>
      <p className="mt-1 max-w-2xl text-sm text-zinc-500">
        Every levered-stable opportunity measurable from public data, ranked by net carry at
        buffered leverage. Rates-only screen: a row is a candidate for measurement, not a trade.
      </p>
      <VenueAuditTable />
    </div>
  );
}
