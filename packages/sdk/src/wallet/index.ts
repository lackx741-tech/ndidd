import type { PublicClient, WalletClient, Address, Hash } from 'viem'
import { keccak256, encodePacked } from 'viem'

// ---------------------------------------------------------------------------
// Smart Wallet (ERC-4337) helpers
// ---------------------------------------------------------------------------

export interface SmartWalletOptions {
  owner: Address
  entryPoint: Address
  factoryAddress: Address
  salt?: bigint
}

const SIMPLE_ACCOUNT_FACTORY_ABI = [
  {
    type: 'function',
    name: 'getAddress',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'salt', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'createAccount',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'salt', type: 'uint256' },
    ],
    outputs: [{ name: 'ret', type: 'address' }],
    stateMutability: 'nonpayable',
  },
] as const

/**
 * Compute the counterfactual address of a smart wallet without deploying it.
 */
export async function getSmartWalletAddress(
  client: PublicClient,
  options: SmartWalletOptions,
): Promise<Address> {
  const salt = options.salt ?? 0n
  return client.readContract({
    address: options.factoryAddress,
    abi: SIMPLE_ACCOUNT_FACTORY_ABI,
    functionName: 'getAddress',
    args: [options.owner, salt],
  })
}

/**
 * Deploy a smart wallet via the factory and return the deployed address and tx hash.
 */
export async function deploySmartWallet(
  client: PublicClient,
  walletClient: WalletClient,
  options: SmartWalletOptions,
): Promise<{ address: Address; hash: Hash }> {
  const salt = options.salt ?? 0n
  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('No account available in WalletClient')

  const hash = await walletClient.writeContract({
    address: options.factoryAddress,
    abi: SIMPLE_ACCOUNT_FACTORY_ABI,
    functionName: 'createAccount',
    args: [options.owner, salt],
    account,
    chain: walletClient.chain ?? null,
  })

  const address = await getSmartWalletAddress(client, options)
  return { address, hash }
}

// ---------------------------------------------------------------------------
// EIP-712 signing helpers
// ---------------------------------------------------------------------------

const TRANSFER_TYPE = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'amount', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
] as const

/**
 * Sign a meta-transfer message using EIP-712.
 */
export async function signTransfer(
  walletClient: WalletClient,
  domain: {
    name: string
    version: string
    chainId: number
    verifyingContract: Address
  },
  message: {
    from: Address
    to: Address
    amount: bigint
    nonce: bigint
    deadline: bigint
  },
): Promise<`0x${string}`> {
  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('No account available in WalletClient')

  return walletClient.signTypedData({
    account,
    domain,
    types: { Transfer: TRANSFER_TYPE },
    primaryType: 'Transfer',
    message,
  })
}

const PERMIT_TYPE = [
  { name: 'owner', type: 'address' },
  { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
] as const

/**
 * Sign an ERC-2612 permit and return split (v, r, s) signature components.
 */
export async function signPermit(
  walletClient: WalletClient,
  tokenAddress: Address,
  spender: Address,
  value: bigint,
  deadline: bigint,
  chainId: number,
  nonce: bigint = 0n,
): Promise<{ v: number; r: `0x${string}`; s: `0x${string}` }> {
  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('No account available in WalletClient')

  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name: 'Permit',
      version: '1',
      chainId,
      verifyingContract: tokenAddress,
    },
    types: { Permit: PERMIT_TYPE },
    primaryType: 'Permit',
    message: {
      owner: account,
      spender,
      value,
      nonce,
      deadline,
    },
  })

  // Split the 65-byte signature into (r, s, v)
  const r = `0x${signature.slice(2, 66)}` as `0x${string}`
  const s = `0x${signature.slice(66, 130)}` as `0x${string}`
  const v = parseInt(signature.slice(130, 132), 16)

  return { v, r, s }
}

/**
 * Compute the keccak256 hash of a description string — used as the
 * `descriptionHash` parameter for Governor queue/execute calls.
 */
export function hashDescription(description: string): `0x${string}` {
  return keccak256(encodePacked(['string'], [description]))
}
