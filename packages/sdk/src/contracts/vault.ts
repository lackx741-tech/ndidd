import type { PublicClient, WalletClient, Address, Hash } from 'viem'
import { NdiddVaultABI } from '../abis/index.js'
import type { EventCallback, DepositEvent, WithdrawalEvent } from '../types/index.js'

export class NdiddVaultClient {
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

  async totalAssets(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'totalAssets',
    })
  }

  async totalSupply(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'totalSupply',
    })
  }

  async balanceOf(account: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'balanceOf',
      args: [account],
    })
  }

  async convertToShares(assets: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'convertToShares',
      args: [assets],
    })
  }

  async convertToAssets(shares: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'convertToAssets',
      args: [shares],
    })
  }

  async previewDeposit(assets: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'previewDeposit',
      args: [assets],
    })
  }

  async previewWithdraw(assets: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'previewWithdraw',
      args: [assets],
    })
  }

  async previewRedeem(shares: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'previewRedeem',
      args: [shares],
    })
  }

  async maxDeposit(receiver: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'maxDeposit',
      args: [receiver],
    })
  }

  async maxWithdraw(owner: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'maxWithdraw',
      args: [owner],
    })
  }

  async getAsset(): Promise<Address> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'asset',
    })
  }

  async deposit(assets: bigint, receiver: Address): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'deposit',
      args: [assets, receiver],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async withdraw(assets: bigint, receiver: Address, owner: Address): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'withdraw',
      args: [assets, receiver, owner],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async redeem(shares: bigint, receiver: Address, owner: Address): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'redeem',
      args: [shares, receiver, owner],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async harvest(): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'harvest',
      args: [],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async setStrategy(strategy: Address): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      functionName: 'setStrategy',
      args: [strategy],
      account,
      chain: wallet.chain ?? null,
    })
  }

  /** Subscribe to Deposit events. Returns an unsubscribe function. */
  watchDeposits(callback: EventCallback<DepositEvent>): () => void {
    return this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      eventName: 'Deposit',
      onLogs: (logs) => {
        for (const log of logs) {
          const { sender, owner, assets, shares } = log.args as {
            sender: Address
            owner: Address
            assets: bigint
            shares: bigint
          }
          callback({ sender, owner, assets, shares })
        }
      },
    })
  }

  /** Subscribe to Withdraw events. Returns an unsubscribe function. */
  watchWithdrawals(callback: EventCallback<WithdrawalEvent>): () => void {
    return this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: NdiddVaultABI,
      eventName: 'Withdraw',
      onLogs: (logs) => {
        for (const log of logs) {
          const { sender, receiver, owner, assets, shares } = log.args as {
            sender: Address
            receiver: Address
            owner: Address
            assets: bigint
            shares: bigint
          }
          callback({ sender, receiver, owner, assets, shares })
        }
      },
    })
  }
}
