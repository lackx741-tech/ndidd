'use client';
import { useReadContract, useWriteContract, useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { NDIDDTOKEN_ABI, TOKEN_ADDRESS } from '@/lib/contracts';

export function useTokenBalance(address?: `0x${string}`) {
  return useReadContract({
    address: TOKEN_ADDRESS,
    abi: NDIDDTOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useTotalSupply() {
  return useReadContract({ address: TOKEN_ADDRESS, abi: NDIDDTOKEN_ABI, functionName: 'totalSupply' });
}

export function useTokenTransfer() {
  const { writeContract, isPending, isSuccess, error } = useWriteContract();
  const transfer = (to: `0x${string}`, amount: string) =>
    writeContract({
      address: TOKEN_ADDRESS,
      abi: NDIDDTOKEN_ABI,
      functionName: 'transfer',
      args: [to, parseUnits(amount, 18)],
    });
  return { transfer, isPending, isSuccess, error };
}

export function useTokenApprove() {
  const { writeContract, isPending, isSuccess, error } = useWriteContract();
  const approve = (spender: `0x${string}`, amount: string) =>
    writeContract({
      address: TOKEN_ADDRESS,
      abi: NDIDDTOKEN_ABI,
      functionName: 'approve',
      args: [spender, parseUnits(amount, 18)],
    });
  return { approve, isPending, isSuccess, error };
}

export function useDelegates(address?: `0x${string}`) {
  return useReadContract({
    address: TOKEN_ADDRESS,
    abi: NDIDDTOKEN_ABI,
    functionName: 'delegates',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useVotingPower(address?: `0x${string}`) {
  return useReadContract({
    address: TOKEN_ADDRESS,
    abi: NDIDDTOKEN_ABI,
    functionName: 'getVotes',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useTokenNonce(address?: `0x${string}`) {
  return useReadContract({
    address: TOKEN_ADDRESS,
    abi: NDIDDTOKEN_ABI,
    functionName: 'nonces',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useDelegate() {
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
