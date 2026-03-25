'use client';
import { useAccount, useReadContract } from 'wagmi';
import { NDIDDTOKEN_ABI, TOKEN_ADDRESS } from '@/lib/contracts';
import { formatAmount } from '@/lib/utils';

export function TokenBalance() {
  const { address } = useAccount();
  const { data: balance, isLoading } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: NDIDDTOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  if (!address) return <span className="text-zinc-500">Not connected</span>;
  if (isLoading) return <span className="text-zinc-400 animate-pulse">Loading...</span>;
  return (
    <span className="font-mono text-lg font-semibold text-white">
      {balance ? formatAmount(balance as bigint) : '0.000'} NDIDD
    </span>
  );
}
