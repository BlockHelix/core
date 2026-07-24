'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AuthNav from './AuthNav';
import { clsx } from 'clsx';

export default function Header() {
  const pathname = usePathname();

  const navLinks: { href: string; label: string }[] = [{ href: '/blog', label: 'Blog' }];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <img src="/logo.svg" alt="BlockHelix" className="w-6 h-6" />
            <span className="text-base font-normal text-gray-900 group-hover:text-[#10c689] transition-colors duration-300">
              Block<span className="font-bold">Helix</span>
            </span>
          </Link>

          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    'text-sm font-medium transition-colors duration-300',
                    isActive(link.href)
                      ? 'text-gray-900'
                      : 'text-gray-500 hover:text-gray-900'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <AuthNav />
          </div>
        </div>
      </div>
    </header>
  );
}
