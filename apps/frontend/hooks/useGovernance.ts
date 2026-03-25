'use client';
import { useReadContract, useWriteContract } from 'wagmi';
import { NDIDDGOVERNOR_ABI, GOVERNOR_ADDRESS, NDIDDTOKEN_ABI, TOKEN_ADDRESS } from '@/lib/contracts';

export function useProposalState(proposalId: bigint) {
  return useReadContract({
    address: GOVERNOR_ADDRESS,
    abi: NDIDDGOVERNOR_ABI,
    functionName: 'state',
    args: [proposalId],
  });
}

export function useCastVote() {
  const { writeContract, isPending, isSuccess, error } = useWriteContract();
  const castVote = (proposalId: bigint, support: 0 | 1 | 2) =>
    writeContract({
      address: GOVERNOR_ADDRESS,
      abi: NDIDDGOVERNOR_ABI,
      functionName: 'castVote',
      args: [proposalId, support],
    });
  return { castVote, isPending, isSuccess, error };
}

export function useVotingPower(address?: `0x${string}`, blockNumber?: bigint) {
  return useReadContract({
    address: GOVERNOR_ADDRESS,
    abi: NDIDDGOVERNOR_ABI,
    functionName: 'getVotes',
    args: address && blockNumber ? [address, blockNumber] : undefined,
    query: { enabled: !!address && !!blockNumber },
  });
}

/**
 * Delegates the connected wallet's voting power to `delegatee`.
 * Writes directly to the NDIDD token contract (ERC20Votes.delegate).
 */
export function useDelegateToken() {
  const { writeContract, isPending, isSuccess, error } = useWriteContract();
  const delegate = (delegatee: `0x${string}`) =>
    writeContract({
      address: TOKEN_ADDRESS,
      abi: NDIDDTOKEN_ABI,
      functionName: 'delegate',
      args: [delegatee],
    });
  return { delegate, isPending, isSuccess, error };
}
