import type { PublicClient, WalletClient, Address, Hash } from 'viem'
import { NdiddGovernorABI } from '../abis/index.js'
import type {
  EventCallback,
  ProposalCreatedEvent,
  VoteCastEvent,
  ProposalState,
} from '../types/index.js'

/** Vote support values matching OZ Governor */
export const VoteSupport = {
  Against: 0,
  For: 1,
  Abstain: 2,
} as const

export type VoteSupportValue = (typeof VoteSupport)[keyof typeof VoteSupport]

export class NdiddGovernorClient {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly contractAddress: Address,
    private readonly walletClient?: WalletClient,
  ) {}

  private requireWalletClient(): WalletClient {
    if (!this.walletClient) {
      throw new Error('WalletClient is required for write operations')
    }
    return this.walletClient
  }

  async getProposalState(proposalId: bigint): Promise<ProposalState> {
    const state = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddGovernorABI,
      functionName: 'state',
      args: [proposalId],
    })
    return state as ProposalState
  }

  async getProposalDeadline(proposalId: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddGovernorABI,
      functionName: 'proposalDeadline',
      args: [proposalId],
    })
  }

  async votingDelay(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddGovernorABI,
      functionName: 'votingDelay',
    })
  }

  async votingPeriod(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddGovernorABI,
      functionName: 'votingPeriod',
    })
  }

  async getVotes(account: Address, blockNumber: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddGovernorABI,
      functionName: 'getVotes',
      args: [account, blockNumber],
    })
  }

  async hasVoted(proposalId: bigint, account: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddGovernorABI,
      functionName: 'hasVoted',
      args: [proposalId, account],
    })
  }

  async quorum(blockNumber: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddGovernorABI,
      functionName: 'quorum',
      args: [blockNumber],
    })
  }

  async propose(
    targets: Address[],
    values: bigint[],
    calldatas: `0x${string}`[],
    description: string,
  ): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddGovernorABI,
      functionName: 'propose',
      args: [targets, values, calldatas, description],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async castVote(proposalId: bigint, support: VoteSupportValue): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddGovernorABI,
      functionName: 'castVote',
      args: [proposalId, support],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async castVoteWithReason(
    proposalId: bigint,
    support: VoteSupportValue,
    reason: string,
  ): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddGovernorABI,
      functionName: 'castVoteWithReason',
      args: [proposalId, support, reason],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async queue(
    targets: Address[],
    values: bigint[],
    calldatas: `0x${string}`[],
    descriptionHash: `0x${string}`,
  ): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddGovernorABI,
      functionName: 'queue',
      args: [targets, values, calldatas, descriptionHash],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async execute(
    targets: Address[],
    values: bigint[],
    calldatas: `0x${string}`[],
    descriptionHash: `0x${string}`,
  ): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddGovernorABI,
      functionName: 'execute',
      args: [targets, values, calldatas, descriptionHash],
      account,
      chain: wallet.chain ?? null,
    })
  }

  /** Subscribe to ProposalCreated events. Returns an unsubscribe function. */
  watchProposals(callback: EventCallback<ProposalCreatedEvent>): () => void {
    return this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: NdiddGovernorABI,
      eventName: 'ProposalCreated',
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as {
            proposalId: bigint
            proposer: Address
            targets: readonly Address[]
            values: readonly bigint[]
            signatures: readonly string[]
            calldatas: readonly `0x${string}`[]
            voteStart: bigint
            voteEnd: bigint
            description: string
          }
          callback({
            proposalId: args.proposalId,
            proposer: args.proposer,
            targets: args.targets,
            values: args.values,
            signatures: args.signatures,
            calldatas: args.calldatas,
            voteStart: args.voteStart,
            voteEnd: args.voteEnd,
            description: args.description,
          })
        }
      },
    })
  }

  /** Subscribe to VoteCast events. Returns an unsubscribe function. */
  watchVotes(callback: EventCallback<VoteCastEvent>): () => void {
    return this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: NdiddGovernorABI,
      eventName: 'VoteCast',
      onLogs: (logs) => {
        for (const log of logs) {
          const { voter, proposalId, support, weight, reason } = log.args as {
            voter: Address
            proposalId: bigint
            support: number
            weight: bigint
            reason: string
          }
          callback({ voter, proposalId, support, weight, reason })
        }
      },
    })
  }
}
