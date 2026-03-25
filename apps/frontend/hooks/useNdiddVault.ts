'use client';
import { useReadContract, useWriteContract, useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { NDIDDVAULT_ABI, VAULT_ADDRESS } from '@/lib/contracts';

export function useVaultStats() {
  const totalAssets = useReadContract({ address: VAULT_ADDRESS, abi: NDIDDVAULT_ABI, functionName: 'totalAssets' });
  const totalSupply = useReadContract({ address: VAULT_ADDRESS, abi: NDIDDVAULT_ABI, functionName: 'totalSupply' });
  return { totalAssets, totalSupply };
}

export function useUserShares(address?: `0x${string}`) {
  return useReadContract({
    address: VAULT_ADDRESS,
    abi: NDIDDVAULT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useVaultDeposit() {
  const { writeContract, isPending, isSuccess, error } = useWriteContract();
  const { address } = useAccount();
  const deposit = (assets: string) => {
    if (!address) return;
    writeContract({
      address: VAULT_ADDRESS,
      abi: NDIDDVAULT_ABI,
      functionName: 'deposit',
      args: [parseUnits(assets, 18), address],
    });
  };
  return { deposit, isPending, isSuccess, error };
}

export function useVaultWithdraw() {
  const { writeContract, isPending, isSuccess, error } = useWriteContract();
  const { address } = useAccount();
  const withdraw = (assets: string) => {
    if (!address) return;
    writeContract({
      address: VAULT_ADDRESS,
      abi: NDIDDVAULT_ABI,
      functionName: 'withdraw',
      args: [parseUnits(assets, 18), address, address],
    });
  };
  return { withdraw, isPending, isSuccess, error };
}
