import { ProposalDetail } from './ProposalDetail';

// Next.js 15: params is a Promise for server components — must be awaited.
export default async function ProposalPage({
  params,
}: {
  params: Promise<{ proposalId: string }>;
}) {
  const { proposalId } = await params;
  return <ProposalDetail proposalId={proposalId} />;
}
