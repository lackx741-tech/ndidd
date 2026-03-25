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
 *
 * @param tokenName - Must match the token contract's EIP-712 domain name
 *   (usually the token's `name()` return value). Passing the wrong name will
 *   produce an invalid signature that the contract will reject.
 */
export async function signPermit(
  walletClient: WalletClient,
  tokenAddress: Address,
  spender: Address,
  value: bigint,
  deadline: bigint,
  chainId: number,
  nonce: bigint = 0n,
  tokenName = 'Token',
): Promise<{ v: number; r: `0x${string}`; s: `0x${string}` }> {
  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('No account available in WalletClient')

  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name: tokenName,
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

// ---------------------------------------------------------------------------
// EIP-712 batch transfer signing
// ---------------------------------------------------------------------------

const BATCH_TRANSFER_TYPES = {
  BatchTransfer: [{ name: 'transfers', type: 'Transfer[]' }],
  Transfer: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

export interface BatchTransferMessage {
  from: Address
  to: Address
  amount: bigint
  nonce: bigint
  deadline: bigint
}

/**
 * Sign a batch of Transfer messages under a single EIP-712 signature.
 * Pass the resulting signature to `EIP712Signer.verifyBatchTransfer` on-chain.
 */
export async function signBatchTransfer(
  walletClient: WalletClient,
  domain: {
    name: string
    version: string
    chainId: number
    verifyingContract: Address
  },
  messages: BatchTransferMessage[],
): Promise<`0x${string}`> {
  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('No account available in WalletClient')

  return walletClient.signTypedData({
    account,
    domain,
    types: BATCH_TRANSFER_TYPES,
    primaryType: 'BatchTransfer',
    message: { transfers: messages },
  })
}

// ---------------------------------------------------------------------------
// EIP-712 delegation signing (ERC20Votes / delegateBySig)
// ---------------------------------------------------------------------------

const DELEGATION_TYPE = [
  { name: 'delegatee', type: 'address' },
  { name: 'nonce', type: 'uint256' },
  { name: 'expiry', type: 'uint256' },
] as const

/**
 * Sign a `delegateBySig` delegation message using EIP-712.
 * Returns split (v, r, s) components for use with `NdiddToken.delegateBySig`
 * or `NdiddToken.delegateBatch`.
 *
 * @param nonce - Current on-chain nonce for the delegator (from `token.nonces(account)`).
 *   The nonce must match the on-chain state exactly; incorrect values will cause
 *   signature verification to fail.
 */
export async function signDelegateBySig(
  walletClient: WalletClient,
  tokenAddress: Address,
  delegatee: Address,
  expiry: bigint,
  chainId: number,
  nonce: bigint,
  tokenName = 'Ndidd Token',
): Promise<{ v: number; r: `0x${string}`; s: `0x${string}` }> {
  const [account] = await walletClient.getAddresses()
  if (!account) throw new Error('No account available in WalletClient')

  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name: tokenName,
      version: '1',
      chainId,
      verifyingContract: tokenAddress,
    },
    types: { Delegation: DELEGATION_TYPE },
    primaryType: 'Delegation',
    message: { delegatee, nonce, expiry },
  })

  const r = `0x${signature.slice(2, 66)}` as `0x${string}`
  const s = `0x${signature.slice(66, 130)}` as `0x${string}`
  const v = parseInt(signature.slice(130, 132), 16)

  return { v, r, s }
}

// ---------------------------------------------------------------------------
// ERC-4337 UserOperation submission via bundler
// ---------------------------------------------------------------------------

export interface UserOpRequest {
  sender: Address
  nonce: `0x${string}`
  initCode: `0x${string}`
  callData: `0x${string}`
  callGasLimit: `0x${string}`
  verificationGasLimit: `0x${string}`
  preVerificationGas: `0x${string}`
  maxFeePerGas: `0x${string}`
  maxPriorityFeePerGas: `0x${string}`
  paymasterAndData: `0x${string}`
  signature: `0x${string}`
}

/**
 * Submit a UserOperation to an ERC-4337 bundler via `eth_sendUserOperation`.
 * Returns the user operation hash.
 *
 * @param bundlerUrl - The bundler JSON-RPC endpoint (e.g. from Alchemy, Pimlico, etc.)
 * @param userOp - The signed UserOperation to submit.
 * @param entryPoint - The EntryPoint contract address.
 */
export async function sendUserOp(
  bundlerUrl: string,
  userOp: UserOpRequest,
  entryPoint: Address,
): Promise<`0x${string}`> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_sendUserOperation',
    params: [userOp, entryPoint],
  })

  const res = await fetch(bundlerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  if (!res.ok) {
    throw new Error(`Bundler HTTP error ${res.status} (${res.statusText}) at ${bundlerUrl}`)
  }

  const json = (await res.json()) as { result?: `0x${string}`; error?: { code?: number; message: string } }
  if (json.error) {
    const code = json.error.code !== undefined ? ` [code ${json.error.code}]` : ''
    throw new Error(`Bundler RPC error${code}: ${json.error.message}`)
  }
  if (!json.result) {
    throw new Error('Bundler returned empty result')
  }
  return json.result
}

/**
 * Estimate gas for a UserOperation via `eth_estimateUserOperationGas`.
 */
export async function estimateUserOpGas(
  bundlerUrl: string,
  userOp: Omit<UserOpRequest, 'callGasLimit' | 'verificationGasLimit' | 'preVerificationGas'> & {
    callGasLimit?: `0x${string}`
    verificationGasLimit?: `0x${string}`
    preVerificationGas?: `0x${string}`
  },
  entryPoint: Address,
): Promise<{ callGasLimit: `0x${string}`; verificationGasLimit: `0x${string}`; preVerificationGas: `0x${string}` }> {
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_estimateUserOperationGas',
    params: [
      {
        ...userOp,
        callGasLimit: userOp.callGasLimit ?? '0x1',
        verificationGasLimit: userOp.verificationGasLimit ?? '0x1',
        preVerificationGas: userOp.preVerificationGas ?? '0x1',
      },
      entryPoint,
    ],
  })

  const res = await fetch(bundlerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  if (!res.ok) {
    throw new Error(`Bundler HTTP error ${res.status} (${res.statusText}) at ${bundlerUrl}`)
  }

  const json = (await res.json()) as {
    result?: { callGasLimit: `0x${string}`; verificationGasLimit: `0x${string}`; preVerificationGas: `0x${string}` }
    error?: { code?: number; message: string }
  }
  if (json.error) {
    const code = json.error.code !== undefined ? ` [code ${json.error.code}]` : ''
    throw new Error(`Bundler RPC error${code}: ${json.error.message}`)
  }
  if (!json.result) {
    throw new Error('Bundler returned empty result')
  }
  return json.result
}
