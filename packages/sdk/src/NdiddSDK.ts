import type { PublicClient, WalletClient, Address } from 'viem'
import { NdiddTokenClient } from './contracts/token.js'
import { NdiddNFTClient } from './contracts/nft.js'
import { NdiddVaultClient } from './contracts/vault.js'
import { NdiddGovernorClient } from './contracts/governance.js'
import { SmartAccountClient } from './contracts/account.js'

export interface NdiddSDKConfig {
  publicClient: PublicClient
  walletClient?: WalletClient
  contracts: {
    token: Address
    nft: Address
    vault: Address
    governor: Address
    /** ERC-4337 AccountFactory address (optional) */
    accountFactory?: Address
  }
}

export class NdiddSDK {
  public readonly token: NdiddTokenClient
  public readonly nft: NdiddNFTClient
  public readonly vault: NdiddVaultClient
  public readonly governance: NdiddGovernorClient
  /** ERC-4337 smart account client. Only available when `contracts.accountFactory` is provided. */
  public readonly account: SmartAccountClient | undefined

  constructor(config: NdiddSDKConfig) {
    const { publicClient, walletClient, contracts } = config

    this.token = new NdiddTokenClient(publicClient, contracts.token, walletClient)
    this.nft = new NdiddNFTClient(publicClient, contracts.nft, walletClient)
    this.vault = new NdiddVaultClient(publicClient, contracts.vault, walletClient)
    this.governance = new NdiddGovernorClient(publicClient, contracts.governor, walletClient)

    if (contracts.accountFactory) {
      this.account = new SmartAccountClient(publicClient, contracts.accountFactory, walletClient)
    }
  }
}
