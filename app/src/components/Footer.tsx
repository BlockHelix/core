import Link from 'next/link';
import CookieSettingsButton from '@/components/consent/CookieSettingsButton';

// Mirrors the defidata.dev footer: brand, plain nav, social, copyright row.
export default function Footer() {
  return (
    <footer className="bg-[#0a0a0a] border-t border-white/10 py-10">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-8 flex-wrap">
            <Link href="/" className="text-sm font-semibold text-white hover:text-emerald-400 transition-colors">
              BlockHelix
            </Link>
            <nav className="flex items-center gap-6">
              <Link href="/blog" className="text-sm text-white/50 hover:text-white transition-colors">
                Blog
              </Link>
              <Link href="/docs" className="text-sm text-white/50 hover:text-white transition-colors">
                Docs
              </Link>
              <Link href="/whitepaper" className="text-sm text-white/50 hover:text-white transition-colors">
                Whitepaper
              </Link>
              <Link href="/privacy" className="text-sm text-white/50 hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-white/50 hover:text-white transition-colors">
                Terms
              </Link>
              <CookieSettingsButton />
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <a href="https://github.com/BlockHelix" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="text-white/40 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </a>
            <a href="https://x.com/BlockHelix" target="_blank" rel="noopener noreferrer" aria-label="X" className="text-white/40 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-2">
          <p className="text-white/40 text-xs">© 2026 DeFi Data Ltd. All rights reserved.</p>
          <p className="text-white/40 text-xs">66 Paul Street, London, England, EC2A 4NA</p>
        </div>
      </div>
    </footer>
  );
}
