'use client';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/Card';
import { TokenBalance } from '@/components/web3/TokenBalance';
import { AddressDisplay } from '@/components/web3/AddressDisplay';
import { useUserShares } from '@/hooks/useNdiddVault';
import { formatAmount } from '@/lib/utils';
import Link from 'next/link';

export default function DashboardPage() {
  const { address, isConnected, chain } = useAccount();
  const { data: shares } = useUserShares(address);

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-zinc-400 mb-4 text-lg">Connect your wallet to view your dashboard.</p>
          <appkit-button />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-white mb-8">Dashboard</h1>

      {/* Wallet info bar */}
      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs text-zinc-500 mb-1">Connected Address</p>
          {address && <AddressDisplay address={address} />}
        </div>
        <div>
          <p className="text-xs text-zinc-500 mb-1">Network</p>
          <span className="text-sm text-zinc-300">{chain?.name ?? '—'}</span>
        </div>
        <div className="ml-auto">
          <appkit-account-button />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
        <Card title="Token Balance">
          <TokenBalance />
        </Card>
        <Card title="Vault Shares">
          <span className="font-mono text-lg font-semibold text-white">
            {shares ? formatAmount(shares as bigint) : '0.000'}
          </span>
        </Card>
        <Card title="Network">
          <span className="text-zinc-300 text-lg">{chain?.name ?? '—'}</span>
        </Card>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { href: '/tokens', label: 'Transfer Tokens', icon: '🪙' },
          { href: '/nft', label: 'Mint NFT', icon: '🖼️' },
          { href: '/vault', label: 'Vault', icon: '🏦' },
          { href: '/smart-wallet', label: 'Smart Wallet', icon: '🔐' },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600 transition-colors text-center">
            <div className="text-2xl mb-2">{l.icon}</div>
            <div className="text-sm text-zinc-300">{l.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'appkit-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      'appkit-account-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
