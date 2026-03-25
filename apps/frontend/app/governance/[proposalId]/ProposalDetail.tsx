'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCastVote } from '@/hooks/useGovernance';

const PROPOSALS: Record<
  string,
  { title: string; description: string; status: string; forVotes: number; againstVotes: number; abstainVotes: number }
> = {
  '1': {
    title: 'Increase vault performance fee to 15%',
    description:
      'This proposal seeks to increase the vault performance fee from 10% to 15% to fund protocol development and security audits. Funds will be allocated to the DAO treasury.',
    status: 'Active',
    forVotes: 850000,
    againstVotes: 120000,
    abstainVotes: 30000,
  },
  '2': {
    title: 'Add USDC as vault asset',
    description:
      'Enable USDC deposits in the vault to increase TVL and provide stable-coin yield options for risk-averse depositors.',
    status: 'Passed',
    forVotes: 1200000,
    againstVotes: 80000,
    abstainVotes: 20000,
  },
  '3': {
    title: 'Deploy on Arbitrum mainnet',
    description:
      'Deploy the full protocol stack on Arbitrum One to benefit from lower gas fees and the growing Arbitrum DeFi ecosystem.',
    status: 'Pending',
    forVotes: 0,
    againstVotes: 0,
    abstainVotes: 0,
  },
};

export function ProposalDetail({ proposalId }: { proposalId: string }) {
  const proposal = PROPOSALS[proposalId];
  const { castVote, isPending } = useCastVote();
  const [voted, setVoted] = useState(false);

  if (!proposal) return <div className="p-10 text-zinc-400">Proposal not found</div>;

  const total = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes || 1;
  const forPct = (proposal.forVotes / total) * 100;
  const againstPct = (proposal.againstVotes / total) * 100;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold text-white">{proposal.title}</h1>
        <Badge
          variant={
            proposal.status === 'Active' ? 'info' : proposal.status === 'Passed' ? 'success' : 'neutral'
          }
        >
          {proposal.status}
        </Badge>
      </div>
      <p className="text-zinc-400 mb-8">{proposal.description}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Votes">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-green-400">For</span>
                <span className="text-zinc-400">{forPct.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full">
                <div className="h-2 bg-green-500 rounded-full" style={{ width: `${forPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-red-400">Against</span>
                <span className="text-zinc-400">{againstPct.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full">
                <div className="h-2 bg-red-500 rounded-full" style={{ width: `${againstPct}%` }} />
              </div>
            </div>
          </div>
        </Card>

        {proposal.status === 'Active' && !voted ? (
          <Card title="Cast Your Vote">
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => { castVote(BigInt(proposalId), 1); setVoted(true); }}
                isLoading={isPending}
                variant="primary"
              >
                Vote For
              </Button>
              <Button
                onClick={() => { castVote(BigInt(proposalId), 0); setVoted(true); }}
                isLoading={isPending}
                variant="danger"
              >
                Vote Against
              </Button>
              <Button
                onClick={() => { castVote(BigInt(proposalId), 2); setVoted(true); }}
                isLoading={isPending}
                variant="secondary"
              >
                Abstain
              </Button>
            </div>
          </Card>
        ) : voted ? (
          <Card title="Voted">
            <p className="text-green-400">Your vote has been submitted!</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
