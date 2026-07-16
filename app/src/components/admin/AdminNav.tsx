'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';

interface NavItem {
  href: string;
  label: string;
  match?: (pathname: string) => boolean;
}

const NAV: NavItem[] = [
  { href: '/admin', label: 'Vaults', match: (p) => p === '/admin' || p.startsWith('/admin/vaults') },
  { href: '/admin/users', label: 'Users', match: (p) => p.startsWith('/admin/users') },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="flex gap-1 overflow-x-auto border-b border-black/[0.06] pb-px lg:flex-col lg:gap-1 lg:border-b-0 lg:pb-0"
    >
      {NAV.map((item) => {
        const active = item.match ? item.match(pathname) : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={clsx(
              'group flex items-center gap-2.5 whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wider-2 transition-colors lg:rounded-md',
              'border-b-2 lg:border-b-0 lg:border-l-2',
              active
                ? 'border-emerald-600 text-emerald-700 lg:bg-emerald-600/[0.06]'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 lg:hover:bg-black/[0.03]',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
