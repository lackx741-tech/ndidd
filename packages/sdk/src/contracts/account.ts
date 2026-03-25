import type { PublicClient, WalletClient, Address, Hash, Hex } from 'viem'
import { AccountFactoryABI, SmartAccountABI } from '../abis/index.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserOperation {
  sender: Address
  nonce: bigint
  initCode: Hex
  callData: Hex
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymasterAndData: Hex
  signature: Hex
}

// ---------------------------------------------------------------------------
// SmartAccountClient
// ---------------------------------------------------------------------------

/**
 * Client for interacting with ERC-4337 SmartAccount and AccountFactory contracts.
 *
 * Supports:
 *  - Counterfactual address computation
 *  - Account deployment via factory
 *  - execute / executeBatch dispatch (owner or EntryPoint)
 *  - Ownership transfer
 *  - Deposit balance queries
 */
export class SmartAccountClient {
  constructor(
    private readonly publicClient: PublicClient,
    private readonly factoryAddress: Address,
    private readonly walletClient?: WalletClient,
  ) {}

  private requireWalletClient(): WalletClient {
    if (!this.walletClient) {
      throw new Error('WalletClient is required for write operations')
    }
    return this.walletClient
  }

  // ── Read helpers ──────────────────────────────────────────────────────────

  /**
   * Computes the counterfactual (pre-deployment) address for a smart wallet.
   * Safe to call before the account is deployed.
   */
  async getAccountAddress(owner: Address, salt = 0n): Promise<Address> {
    return this.publicClient.readContract({
      address: this.factoryAddress,
      abi: AccountFactoryABI,
      functionName: 'getAddress',
      args: [owner, salt],
    })
  }

  /** Returns true if the smart wallet has already been deployed. */
  async isDeployed(owner: Address, salt = 0n): Promise<boolean> {
    const address = await this.getAccountAddress(owner, salt)
    const code = await this.publicClient.getCode({ address })
    return !!code && code !== '0x'
  }

  /** Returns the owner of a deployed SmartAccount. */
  async getOwner(accountAddress: Address): Promise<Address> {
    return this.publicClient.readContract({
      address: accountAddress,
      abi: SmartAccountABI,
      functionName: 'owner',
    })
  }

  /** Returns the EntryPoint address registered on a deployed SmartAccount. */
  async getEntryPoint(accountAddress: Address): Promise<Address> {
    return this.publicClient.readContract({
      address: accountAddress,
      abi: SmartAccountABI,
      functionName: 'entryPoint',
    })
  }

  /**
   * Returns the ETH balance deposited by this account at the EntryPoint.
   * This is the prefund used to cover gas costs.
   */
  async getDeposit(accountAddress: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: accountAddress,
      abi: SmartAccountABI,
      functionName: 'getDeposit',
    })
  }

  // ── Write helpers ─────────────────────────────────────────────────────────

  /**
   * Deploys a SmartAccount for the given owner + salt via the factory.
   * Returns the deployed address and the transaction hash.
   *
   * If the account is already deployed, the transaction is a no-op on-chain
   * (factory is idempotent) but still costs gas — call `isDeployed` first.
   */
  async deployAccount(
    owner: Address,
    salt = 0n,
  ): Promise<{ address: Address; hash: Hash }> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')

    const hash = await wallet.writeContract({
      address: this.factoryAddress,
      abi: AccountFactoryABI,
      functionName: 'createAccount',
      args: [owner, salt],
      account,
      chain: wallet.chain ?? null,
    })

    const address = await this.getAccountAddress(owner, salt)
    return { address, hash }
  }

  /**
   * Executes a single call from the SmartAccount.
   * Must be called by the account owner (or EntryPoint for ERC-4337 flow).
   */
  async execute(
    accountAddress: Address,
    dest: Address,
    value: bigint,
    data: Hex,
  ): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')

    return wallet.writeContract({
      address: accountAddress,
      abi: SmartAccountABI,
      functionName: 'execute',
      args: [dest, value, data],
      account,
      chain: wallet.chain ?? null,
    })
  }

  /**
   * Executes multiple calls atomically from the SmartAccount.
   * Must be called by the account owner (or EntryPoint).
   */
  async executeBatch(
    accountAddress: Address,
    dest: readonly Address[],
    data: readonly Hex[],
  ): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')

    return wallet.writeContract({
      address: accountAddress,
      abi: SmartAccountABI,
      functionName: 'executeBatch',
      args: [dest, data],
      account,
      chain: wallet.chain ?? null,
    })
  }

  /**
   * Transfers ownership of the SmartAccount to a new address.
   * Must be called by the current owner.
   */
  async transferOwnership(accountAddress: Address, newOwner: Address): Promise<Hash> {
    const wallet = this.requireWalletClient()
    const [account] = await wallet.getAddresses()
    if (!account) throw new Error('No account available in WalletClient')

    return wallet.writeContract({
      address: accountAddress,
      abi: SmartAccountABI,
      functionName: 'transferOwnership',
      args: [newOwner],
      account,
      chain: wallet.chain ?? null,
    })
  }

  // ── UserOperation helpers ─────────────────────────────────────────────────

  /**
   * Builds a minimal UserOperation for a single `execute` call.
   * Fills all gas fields with conservative defaults — override as needed
   * (e.g., use a bundler estimation API for production).
   */
  buildExecuteUserOp(
    accountAddress: Address,
    dest: Address,
    value: bigint,
    data: Hex,
    nonce = 0n,
    paymasterAndData: Hex = '0x',
  ): UserOperation {
    const executeCalldata = this._encodeExecute(dest, value, data)
    return {
      sender: accountAddress,
      nonce,
      initCode: '0x',
      callData: executeCalldata,
      callGasLimit: 200_000n,
      verificationGasLimit: 150_000n,
      preVerificationGas: 21_000n,
      maxFeePerGas: 2_000_000_000n, // 2 gwei
      maxPriorityFeePerGas: 1_000_000_000n, // 1 gwei
      paymasterAndData,
      signature: '0x',
    }
  }

  /**
   * Builds the `initCode` for deploying a new SmartAccount via a bundler.
   * Concatenates the factory address + the `createAccount` calldata.
   */
  buildInitCode(owner: Address, salt = 0n): Hex {
    const calldata = this._encodeCreateAccount(owner, salt)
    return `${this.factoryAddress}${calldata.slice(2)}` as Hex
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _encodeExecute(dest: Address, value: bigint, data: Hex): Hex {
    // execute(address dest, uint256 value, bytes calldata data) selector = 0xb61d27f6
    const selector = '0xb61d27f6'
    const paddedDest = dest.slice(2).padStart(64, '0')
    const paddedValue = value.toString(16).padStart(64, '0')
    const dataOffset = (96).toString(16).padStart(64, '0') // offset to data (3 * 32 bytes)
    const dataLen = ((data.length - 2) / 2).toString(16).padStart(64, '0')
    const dataHex = (data.slice(2) + '0'.repeat((32 - ((data.length - 2) / 2) % 32) % 32)).padEnd(
      Math.ceil((data.length - 2) / 64) * 64,
      '0',
    )
    return `${selector}${paddedDest}${paddedValue}${dataOffset}${dataLen}${dataHex}` as Hex
  }

  private _encodeCreateAccount(owner: Address, salt: bigint): Hex {
    // createAccount(address owner, uint256 salt) selector = 0x5fbfb9cf
    const selector = '0x5fbfb9cf'
    const paddedOwner = owner.slice(2).padStart(64, '0')
    const paddedSalt = salt.toString(16).padStart(64, '0')
    return `${selector}${paddedOwner}${paddedSalt}` as Hex
  }
}
