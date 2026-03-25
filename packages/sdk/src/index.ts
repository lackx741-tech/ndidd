// Main SDK class
export { NdiddSDK } from './NdiddSDK.js'
export type { NdiddSDKConfig } from './NdiddSDK.js'

// Contract clients
export { NdiddTokenClient } from './contracts/token.js'
export { NdiddNFTClient } from './contracts/nft.js'
export { NdiddVaultClient } from './contracts/vault.js'
export { NdiddGovernorClient, VoteSupport } from './contracts/governance.js'
export type { VoteSupportValue } from './contracts/governance.js'
export { SmartAccountClient } from './contracts/account.js'
export type { UserOperation } from './contracts/account.js'

// ABIs
export {
  NdiddTokenABI,
  NdiddNFTABI,
  NdiddVaultABI,
  NdiddGovernorABI,
  AccountFactoryABI,
  SmartAccountABI,
  NdiddPaymasterABI,
  EIP712SignerABI,
} from './abis/index.js'

// Types
export {
  TransactionStatus,
  ProposalState,
} from './types/index.js'
export type {
  EventCallback,
  TokenConfig,
  NFTConfig,
  VaultConfig,
  GovernanceConfig,
  ProtocolConfig,
  TransferEvent,
  MintEvent,
  DepositEvent,
  WithdrawalEvent,
  ProposalCreatedEvent,
  VoteCastEvent,
} from './types/index.js'

// Wallet utilities
export {
  getSmartWalletAddress,
  deploySmartWallet,
  signTransfer,
  signPermit,
  signBatchTransfer,
  signDelegateBySig,
  sendUserOp,
  estimateUserOpGas,
  hashDescription,
} from './wallet/index.js'
export type { SmartWalletOptions, BatchTransferMessage, UserOpRequest } from './wallet/index.js'

// Utilities
export {
  formatTokenAmount,
  parseTokenAmount,
  calculateGasWithBuffer,
  waitForTransaction,
  isValidAddress,
  getExplorerUrl,
  SUPPORTED_CHAINS,
} from './utils/index.js'
export type { ChainConfig } from './utils/index.js'
