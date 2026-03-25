import type { PublicClient, WalletClient, Address, Hash } from 'viem'
import { formatUnits } from 'viem'
import { NdiddTokenABI } from '../abis/index.js'
import type { EventCallback, TransferEvent } from '../types/index.js'

export class NdiddTokenClient {
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

  async getBalance(address: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddTokenABI,
      functionName: 'balanceOf',
      args: [address],
    })
  }

  async getTotalSupply(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddTokenABI,
      functionName: 'totalSupply',
    })
  }

  async getAllowance(owner: Address, spender: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddTokenABI,
      functionName: 'allowance',
      args: [owner, spender],
    })
  }

  async getDecimals(): Promise<number> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddTokenABI,
      functionName: 'decimals',
    })
  }

  async isPaused(): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddTokenABI,
      functionName: 'paused',
    })
  }

  async transfer(to: Address, amount: bigint): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddTokenABI,
      functionName: 'transfer',
      args: [to, amount],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async approve(spender: Address, amount: bigint): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddTokenABI,
      functionName: 'approve',
      args: [spender, amount],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async mint(to: Address, amount: bigint): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddTokenABI,
      functionName: 'mint',
      args: [to, amount],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async burn(amount: bigint): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddTokenABI,
      functionName: 'burn',
      args: [amount],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async pause(): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddTokenABI,
      functionName: 'pause',
      args: [],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async unpause(): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddTokenABI,
      functionName: 'unpause',
      args: [],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async hasRole(role: `0x${string}`, account: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddTokenABI,
      functionName: 'hasRole',
      args: [role, account],
    })
  }

  async grantRole(role: `0x${string}`, account: Address): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [sender] = await wallet.getAddresses()
    if (!sender) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddTokenABI,
      functionName: 'grantRole',
      args: [role, account],
      account: sender,
      chain: wallet.chain ?? null,
    })
  }

  /** Returns the token balance formatted with the token's own decimal precision. */
  async getBalanceFormatted(address: Address): Promise<string> {
    const [balance, decimals] = await Promise.all([
      this.getBalance(address),
      this.getDecimals(),
    ])
    return formatUnits(balance, decimals)
  }

  /**
   * Subscribe to Transfer events.
   * Returns an unsubscribe function.
   */
  watchTransfers(callback: EventCallback<TransferEvent>): () => void {
    const unwatch = this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: NdiddTokenABI,
      eventName: 'Transfer',
      onLogs: (logs) => {
        for (const log of logs) {
          const { from, to, value } = log.args as {
            from: Address
            to: Address
            value: bigint
          }
          callback({ from, to, amount: value })
        }
      },
    })
    return unwatch
  }
}
