'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  // Extra path prefixes that should also mark this item active.
  match?: string[];
}

const KeyIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M15 7a4 4 0 11-3.9 5H8v2H6v2H3v-3l5.1-5.1A4 4 0 0115 7z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="15.5" cy="6.5" r="0.9" fill="currentColor" />
  </svg>
);

const VaultIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="3" y="4" width="18" height="16" rx="1" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 8.8V6.5M12 15.2V17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'API Keys', icon: KeyIcon },
  { href: '/dashboard/vaults', label: 'Vaults', icon: VaultIcon, match: ['/dashboard/new-vault'] },
];

export default function DashboardNav() {
  const pathname = usePathname();

  const isActive = (item: NavItem) => {
    if (item.href === '/dashboard') return pathname === '/dashboard';
    if (pathname.startsWith(item.href)) return true;
    return (item.match ?? []).some((m) => pathname.startsWith(m));
  };

  return (
    <nav
      aria-label="Dashboard sections"
      className="flex gap-1 overflow-x-auto border-b border-black/[0.06] pb-px lg:flex-col lg:gap-1 lg:border-b-0 lg:pb-0"
    >
      {NAV.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'group flex items-center gap-2.5 whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wider-2 transition-colors lg:rounded-md',
              // mobile: underline tab. desktop: left-border rail.
              'border-b-2 lg:border-b-0 lg:border-l-2',
              active
                ? 'border-emerald-600 text-emerald-700 lg:bg-emerald-600/[0.06]'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 lg:hover:bg-black/[0.03]',
            )}
          >
            <span className={clsx('transition-colors', active ? 'text-emerald-600' : 'text-zinc-400 group-hover:text-zinc-600')}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
