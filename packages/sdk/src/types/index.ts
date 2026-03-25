export enum TransactionStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Failed = 'failed',
  Reverted = 'reverted',
}

/** Mirrors OpenZeppelin Governor proposal states */
export enum ProposalState {
  Pending = 0,
  Active = 1,
  Canceled = 2,
  Defeated = 3,
  Succeeded = 4,
  Queued = 5,
  Expired = 6,
  Executed = 7,
}

export type EventCallback<T> = (event: T) => void

export interface TokenConfig {
  address: `0x${string}`
  decimals: number
  symbol: string
  name: string
}

export interface NFTConfig {
  address: `0x${string}`
  name: string
  symbol: string
  baseURI?: string
}

export interface VaultConfig {
  address: `0x${string}`
  asset: `0x${string}`
  name: string
  symbol: string
}

export interface GovernanceConfig {
  address: `0x${string}`
  token: `0x${string}`
  votingDelay: bigint
  votingPeriod: bigint
}

export interface ProtocolConfig {
  token: TokenConfig
  nft: NFTConfig
  vault: VaultConfig
  governance: GovernanceConfig
}

export interface TransferEvent {
  from: `0x${string}`
  to: `0x${string}`
  amount: bigint
}

export interface MintEvent {
  to: `0x${string}`
  tokenId: bigint
}

export interface DepositEvent {
  sender: `0x${string}`
  owner: `0x${string}`
  assets: bigint
  shares: bigint
}

export interface WithdrawalEvent {
  sender: `0x${string}`
  receiver: `0x${string}`
  owner: `0x${string}`
  assets: bigint
  shares: bigint
}

export interface ProposalCreatedEvent {
  proposalId: bigint
  proposer: `0x${string}`
  targets: readonly `0x${string}`[]
  values: readonly bigint[]
  signatures: readonly string[]
  calldatas: readonly `0x${string}`[]
  voteStart: bigint
  voteEnd: bigint
  description: string
}

export interface VoteCastEvent {
  voter: `0x${string}`
  proposalId: bigint
  support: number
  weight: bigint
  reason: string
}
