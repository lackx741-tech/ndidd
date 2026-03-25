'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/tokens', label: 'Tokens' },
  { href: '/nft', label: 'NFT' },
  { href: '/vault', label: 'Vault' },
  { href: '/governance', label: 'Governance' },
  { href: '/smart-wallet', label: 'Smart Wallet' },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent flex-shrink-0">
          NDIDD
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1 mx-6">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'px-3 py-2 rounded-md text-sm transition-colors',
                pathname === l.href
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Reown AppKit Connect Button — uses the custom web component injected by AppKit */}
        <appkit-button />
      </div>
    </header>
  );
}

// Augment JSX to accept the AppKit web component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'appkit-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'appkit-account-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'appkit-network-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
