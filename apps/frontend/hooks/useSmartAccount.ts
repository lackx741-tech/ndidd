'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import type { Address, Hex } from 'viem';
import {
  ACCOUNT_FACTORY_ADDRESS,
  ACCOUNT_FACTORY_ABI,
  SMART_ACCOUNT_ABI,
  NDIDDPAYMASTER_ABI,
  PAYMASTER_ADDRESS,
} from '@/lib/contracts';
import { formatAmount } from '@/lib/utils';

// ── Counterfactual address ─────────────────────────────────────────────────

/**
 * Returns the deterministic smart wallet address for the connected EOA.
 * This address is valid even before deployment (counterfactual).
 */
export function useSmartWalletAddress(salt = 0n) {
  const { address: owner } = useAccount();

  return useReadContract({
    address: ACCOUNT_FACTORY_ADDRESS,
    abi: ACCOUNT_FACTORY_ABI,
    functionName: 'getAddress',
    args: owner ? [owner, salt] : undefined,
    query: { enabled: !!owner },
  });
}

// ── Deployment status ──────────────────────────────────────────────────────

/**
 * Returns whether the smart wallet has been deployed on-chain.
 */
export function useIsSmartWalletDeployed(smartWalletAddress?: Address) {
  const client = usePublicClient();
  const [isDeployed, setIsDeployed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!smartWalletAddress || !client) return;
    let cancelled = false;
    client.getCode({ address: smartWalletAddress }).then((code) => {
      if (!cancelled) setIsDeployed(!!code && code !== '0x');
    });
    return () => { cancelled = true; };
  }, [smartWalletAddress, client]);

  return isDeployed;
}

// ── Deploy smart wallet ────────────────────────────────────────────────────

/**
 * Deploys the smart wallet for the connected EOA via AccountFactory.createAccount.
 */
export function useDeploySmartWallet(salt = 0n) {
  const { address: owner } = useAccount();
  const { writeContract, isPending, isSuccess, error, data: txHash } = useWriteContract();

  const deploy = useCallback(() => {
    if (!owner) return;
    writeContract({
      address: ACCOUNT_FACTORY_ADDRESS,
      abi: ACCOUNT_FACTORY_ABI,
      functionName: 'createAccount',
      args: [owner, salt],
    });
  }, [owner, salt, writeContract]);

  return { deploy, isPending, isSuccess, error, txHash };
}

// ── Smart wallet reads ─────────────────────────────────────────────────────

/**
 * Returns the owner of a deployed SmartAccount.
 */
export function useSmartWalletOwner(smartWalletAddress?: Address) {
  return useReadContract({
    address: smartWalletAddress,
    abi: SMART_ACCOUNT_ABI,
    functionName: 'owner',
    query: { enabled: !!smartWalletAddress },
  });
}

/**
 * Returns the prefund deposit balance of a SmartAccount at the EntryPoint.
 */
export function useSmartWalletDeposit(smartWalletAddress?: Address) {
  return useReadContract({
    address: smartWalletAddress,
    abi: SMART_ACCOUNT_ABI,
    functionName: 'getDeposit',
    query: { enabled: !!smartWalletAddress },
  });
}

// ── Smart wallet writes ────────────────────────────────────────────────────

/**
 * Executes a single call from the SmartAccount (owner must be connected).
 */
export function useSmartWalletExecute(smartWalletAddress?: Address) {
  const { writeContract, isPending, isSuccess, error } = useWriteContract();

  const execute = useCallback(
    (dest: Address, value: bigint, data: Hex) => {
      if (!smartWalletAddress) return;
      writeContract({
        address: smartWalletAddress,
        abi: SMART_ACCOUNT_ABI,
        functionName: 'execute',
        args: [dest, value, data],
      });
    },
    [smartWalletAddress, writeContract],
  );

  return { execute, isPending, isSuccess, error };
}

/**
 * Transfers ownership of the SmartAccount to a new address.
 */
export function useTransferSmartWalletOwnership(smartWalletAddress?: Address) {
  const { writeContract, isPending, isSuccess, error } = useWriteContract();

  const transferOwnership = useCallback(
    (newOwner: Address) => {
      if (!smartWalletAddress) return;
      writeContract({
        address: smartWalletAddress,
        abi: SMART_ACCOUNT_ABI,
        functionName: 'transferOwnership',
        args: [newOwner],
      });
    },
    [smartWalletAddress, writeContract],
  );

  return { transferOwnership, isPending, isSuccess, error };
}

// ── Paymaster reads ────────────────────────────────────────────────────────

/** Returns current paymaster deposit and configuration. */
export function usePaymasterInfo() {
  const deposit = useReadContract({
    address: PAYMASTER_ADDRESS,
    abi: NDIDDPAYMASTER_ABI,
    functionName: 'getDeposit',
  });
  const minBalance = useReadContract({
    address: PAYMASTER_ADDRESS,
    abi: NDIDDPAYMASTER_ABI,
    functionName: 'minTokenBalance',
  });
  const paused = useReadContract({
    address: PAYMASTER_ADDRESS,
    abi: NDIDDPAYMASTER_ABI,
    functionName: 'paused',
  });
  return { deposit, minBalance, paused };
}

// ── Composite hook ─────────────────────────────────────────────────────────

/**
 * All-in-one hook for interacting with the ERC-4337 smart wallet system.
 *
 * Returns:
 *  - `smartWalletAddress` — counterfactual or deployed address
 *  - `isDeployed` — whether the wallet is deployed
 *  - `deploy` — function to deploy the wallet
 *  - `deployPending` — deploy tx in-flight
 *  - `depositFormatted` — EntryPoint deposit as human-readable string
 *  - `paymasterPaused` — whether the paymaster is paused
 */
export function useSmartAccount(salt = 0n) {
  const { address: eoa, isConnected } = useAccount();

  // Counterfactual address
  const { data: smartWalletAddress } = useSmartWalletAddress(salt);

  // Deployment status
  const isDeployed = useIsSmartWalletDeployed(smartWalletAddress as Address | undefined);

  // Deploy
  const { deploy, isPending: deployPending, isSuccess: deploySuccess, txHash: deployTxHash } =
    useDeploySmartWallet(salt);

  // Deposit at EntryPoint
  const { data: deposit } = useSmartWalletDeposit(
    isDeployed ? (smartWalletAddress as Address) : undefined,
  );

  // Paymaster
  const { paused } = usePaymasterInfo();

  const depositFormatted = deposit !== undefined ? formatAmount(deposit as bigint) : undefined;

  return {
    eoa,
    isConnected,
    smartWalletAddress: smartWalletAddress as Address | undefined,
    isDeployed,
    deploy,
    deployPending,
    deploySuccess,
    deployTxHash,
    deposit: deposit as bigint | undefined,
    depositFormatted,
    paymasterPaused: paused.data as boolean | undefined,
  };
}

// ── Batch execute ──────────────────────────────────────────────────────────

/**
 * Executes multiple calls atomically from the SmartAccount in a single tx.
 */
export function useSmartWalletBatchExecute(smartWalletAddress?: Address) {
  const { writeContract, isPending, isSuccess, error } = useWriteContract();

  const executeBatch = useCallback(
    (dest: Address[], data: Hex[]) => {
      if (!smartWalletAddress) return;
      writeContract({
        address: smartWalletAddress,
        abi: SMART_ACCOUNT_ABI,
        functionName: 'executeBatch',
        args: [dest, data],
      });
    },
    [smartWalletAddress, writeContract],
  );

  return { executeBatch, isPending, isSuccess, error };
}
