'use client';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TokenBalance } from '@/components/web3/TokenBalance';
import { AddressDisplay } from '@/components/web3/AddressDisplay';
import { TransactionButton } from '@/components/web3/TransactionButton';
import { useUserShares } from '@/hooks/useNdiddVault';
import { useDelegates, useVotingPower, useDelegate } from '@/hooks/useNdiddToken';
import { formatAmount } from '@/lib/utils';
import Link from 'next/link';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export default function DashboardPage() {
  const { address, isConnected, chain } = useAccount();
  const { data: shares } = useUserShares(address);
  const { data: currentDelegate } = useDelegates(address);
  const { data: votingPower } = useVotingPower(address);
  const { delegate, isPending: delegatePending, isSuccess: delegateSuccess } = useDelegate();

  const [delegateTo, setDelegateTo] = useState('');

  const isSelfDelegated =
    currentDelegate && address
      ? currentDelegate.toLowerCase() === address.toLowerCase()
      : false;

  const isDelegated =
    currentDelegate &&
    currentDelegate !== ZERO_ADDRESS &&
    !isSelfDelegated;

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

      {/* Delegation panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-8">
        {/* Delegation status */}
        <Card title="Voting Delegation">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">Voting Power</span>
              <span className="text-white font-mono text-sm">
                {votingPower !== undefined ? formatAmount(votingPower as bigint) : '—'} NDIDD
              </span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-zinc-400 text-sm">Current Delegate</span>
              <div className="text-right">
                {currentDelegate && currentDelegate !== ZERO_ADDRESS ? (
                  isSelfDelegated ? (
                    <span className="text-green-400 text-sm" aria-label="Self-delegated and active">
                      ✓ Self (active)
                    </span>
                  ) : (
                    <AddressDisplay address={currentDelegate} />
                  )
                ) : (
                  <span className="text-yellow-400 text-sm" aria-label="Not delegated, voting power inactive">
                    ⚠ Not delegated — voting power inactive
                  </span>
                )}
              </div>
            </div>
            {isDelegated && (
              <p className="text-xs text-zinc-500">
                Your votes are delegated to the address above.
              </p>
            )}
            {!currentDelegate || currentDelegate === ZERO_ADDRESS ? (
              <p className="text-xs text-yellow-500">
                Delegate to yourself or another address to activate your voting power.
              </p>
            ) : null}
          </div>
        </Card>

        {/* Delegate action */}
        <Card title="Set Delegate">
          <p className="text-zinc-400 text-sm mb-4">
            Delegate your NDIDD voting power to yourself or another address. You keep your tokens.
          </p>
          <div className="space-y-3">
            <Input
              label="Delegate Address"
              placeholder={address ?? '0x...'}
              value={delegateTo}
              onChange={(e) => setDelegateTo(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                onClick={() => address && delegate(address)}
                isLoading={delegatePending}
                disabled={delegatePending || (isSelfDelegated ?? false)}
                className="flex-1"
                variant="secondary"
              >
                {isSelfDelegated ? 'Self-delegated ✓' : 'Delegate to Self'}
              </Button>
              <TransactionButton
                label="Delegate"
                isPending={delegatePending}
                isSuccess={delegateSuccess}
                disabled={!delegateTo}
                onClick={() => delegateTo && delegate(delegateTo as `0x${string}`)}
                className="flex-1"
              />
            </div>
          </div>
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
