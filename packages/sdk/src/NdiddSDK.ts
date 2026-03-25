import type { PublicClient, WalletClient, Address } from 'viem'
import { NdiddTokenClient } from './contracts/token.js'
import { NdiddNFTClient } from './contracts/nft.js'
import { NdiddVaultClient } from './contracts/vault.js'
import { NdiddGovernorClient } from './contracts/governance.js'

export interface NdiddSDKConfig {
  publicClient: PublicClient
  walletClient?: WalletClient
  contracts: {
    token: Address
    nft: Address
    vault: Address
    governor: Address
  }
}

export class NdiddSDK {
  public readonly token: NdiddTokenClient
  public readonly nft: NdiddNFTClient
  public readonly vault: NdiddVaultClient
  public readonly governance: NdiddGovernorClient

  constructor(config: NdiddSDKConfig) {
    const { publicClient, walletClient, contracts } = config

    this.token = new NdiddTokenClient(publicClient, contracts.token, walletClient)
    this.nft = new NdiddNFTClient(publicClient, contracts.nft, walletClient)
    this.vault = new NdiddVaultClient(publicClient, contracts.vault, walletClient)
    this.governance = new NdiddGovernorClient(publicClient, contracts.governor, walletClient)
  }
}
