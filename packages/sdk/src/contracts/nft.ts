import type { PublicClient, WalletClient, Address, Hash } from 'viem'
import { NdiddNFTABI } from '../abis/index.js'
import type { EventCallback, MintEvent } from '../types/index.js'

export class NdiddNFTClient {
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

  async getOwner(tokenId: bigint): Promise<Address> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddNFTABI,
      functionName: 'ownerOf',
      args: [tokenId],
    })
  }

  async balanceOf(address: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddNFTABI,
      functionName: 'balanceOf',
      args: [address],
    })
  }

  async getTokenURI(tokenId: bigint): Promise<string> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddNFTABI,
      functionName: 'tokenURI',
      args: [tokenId],
    })
  }

  async totalSupply(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddNFTABI,
      functionName: 'totalSupply',
    })
  }

  async getMintPrice(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddNFTABI,
      functionName: 'mintPrice',
    })
  }

  async isApprovedForAll(owner: Address, operator: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: NdiddNFTABI,
      functionName: 'isApprovedForAll',
      args: [owner, operator],
    })
  }

  async publicMint(quantity: bigint, value: bigint): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddNFTABI,
      functionName: 'publicMint',
      args: [quantity],
      value,
      account,
      chain: wallet.chain ?? null,
    })
  }

  async safeMint(to: Address, uri: string): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddNFTABI,
      functionName: 'safeMint',
      args: [to, uri],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async batchMint(to: Address, quantity: bigint): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddNFTABI,
      functionName: 'batchMint',
      args: [to, quantity],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async setMintPrice(price: bigint): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddNFTABI,
      functionName: 'setMintPrice',
      args: [price],
      account,
      chain: wallet.chain ?? null,
    })
  }

  async setApprovalForAll(operator: Address, approved: boolean): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')
    return wallet.writeContract({
      address: this.contractAddress,
      abi: NdiddNFTABI,
      functionName: 'setApprovalForAll',
      args: [operator, approved],
      account,
      chain: wallet.chain ?? null,
    })
  }

  /**
   * Subscribe to Transfer events where `from` is the zero address (i.e. mints).
   * Returns an unsubscribe function.
   */
  watchMints(callback: EventCallback<MintEvent>): () => void {
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
    const unwatch = this.publicClient.watchContractEvent({
      address: this.contractAddress,
      abi: NdiddNFTABI,
      eventName: 'Transfer',
      args: { from: ZERO_ADDRESS },
      onLogs: (logs) => {
        for (const log of logs) {
          const { to, tokenId } = log.args as { from: Address; to: Address; tokenId: bigint }
          callback({ to, tokenId })
        }
      },
    })
    return unwatch
  }
}
