import type { PublicClient, TransactionReceipt } from 'viem'
import { formatUnits, parseUnits, isAddress } from 'viem'

/**
 * Format a raw token amount (bigint) into a human-readable string.
 */
export function formatTokenAmount(amount: bigint, decimals: number): string {
  return formatUnits(amount, decimals)
}

/**
 * Parse a human-readable token amount string into a raw bigint.
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  return parseUnits(amount, decimals)
}

/**
 * Add a percentage buffer on top of an estimated gas value.
 * Defaults to 20 % buffer.
 *
 * Note: uses integer division, so the result is truncated (rounded down).
 * This is intentionally conservative — callers that require a strict upper
 * bound should round up themselves.
 */
export function calculateGasWithBuffer(gas: bigint, bufferPercent = 20): bigint {
  return (gas * BigInt(100 + bufferPercent)) / 100n
}

/**
 * Wait for a transaction to be mined and return its receipt.
 * Throws if the transaction reverted.
 */
export async function waitForTransaction(
  client: PublicClient,
  hash: `0x${string}`,
): Promise<TransactionReceipt> {
  const receipt = await client.waitForTransactionReceipt({ hash })
  if (receipt.status === 'reverted') {
    throw new Error(`Transaction ${hash} reverted`)
  }
  return receipt
}

/**
 * Validates that a string is a checksummed or lowercase Ethereum address.
 */
export function isValidAddress(address: string): boolean {
  return isAddress(address)
}

const EXPLORER_URLS: Record<number, string> = {
  1: 'https://etherscan.io',
  5: 'https://goerli.etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  137: 'https://polygonscan.com',
  80001: 'https://mumbai.polygonscan.com',
  42161: 'https://arbiscan.io',
  421613: 'https://goerli.arbiscan.io',
  10: 'https://optimistic.etherscan.io',
  420: 'https://goerli-optimism.etherscan.io',
  8453: 'https://basescan.org',
  84531: 'https://goerli.basescan.org',
}

/**
 * Build a block-explorer URL for a transaction, address, or token.
 */
export function getExplorerUrl(
  chainId: number,
  value: string,
  type: 'tx' | 'address' | 'token',
): string {
  const base = EXPLORER_URLS[chainId]
  if (!base) {
    throw new Error(`Unsupported chainId: ${chainId}`)
  }
  return `${base}/${type}/${value}`
}

export interface ChainConfig {
  id: number
  name: string
  rpcUrl: string
  explorerUrl: string
  nativeCurrency: { name: string; symbol: string; decimals: number }
}

export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  1: {
    id: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://cloudflare-eth.com',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  11155111: {
    id: 11155111,
    name: 'Sepolia Testnet',
    rpcUrl: 'https://rpc.sepolia.org',
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  },
  137: {
    id: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  },
  42161: {
    id: 42161,
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  10: {
    id: 10,
    name: 'Optimism',
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  8453: {
    id: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
}
