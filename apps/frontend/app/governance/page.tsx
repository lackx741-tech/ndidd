'use client';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';

const PROPOSALS = [
  { id: '1', title: 'Increase vault performance fee to 15%', status: 'Active', forVotes: 850000, againstVotes: 120000 },
  { id: '2', title: 'Add USDC as vault asset', status: 'Passed', forVotes: 1200000, againstVotes: 80000 },
  { id: '3', title: 'Deploy on Arbitrum mainnet', status: 'Pending', forVotes: 0, againstVotes: 0 },
];

const statusVariant: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  Active: 'info',
  Passed: 'success',
  Failed: 'warning',
  Pending: 'neutral',
};

export default function GovernancePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Governance</h1>
      </div>
      <div className="space-y-4">
        {PROPOSALS.map((p) => (
          <Link
            key={p.id}
            href={`/governance/${p.id}`}
            className="block rounded-xl border border-zinc-800 bg-zinc-900 p-6 hover:border-zinc-600 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-medium text-white">{p.title}</h3>
              <Badge variant={statusVariant[p.status] ?? 'neutral'}>{p.status}</Badge>
            </div>
            {p.forVotes > 0 && (
              <div className="flex gap-4 text-sm">
                <span className="text-green-400">For: {(p.forVotes / 1e6).toFixed(2)}M</span>
                <span className="text-red-400">Against: {(p.againstVotes / 1e6).toFixed(2)}M</span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
