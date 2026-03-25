import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PublicClient, WalletClient } from 'viem'
import { NdiddTokenClient } from '../contracts/token.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890' as const
const ALICE = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as const
const BOB = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const
const MOCK_HASH = '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1' as const

function makePublicClient(overrides: Partial<PublicClient> = {}): PublicClient {
  return {
    readContract: vi.fn(),
    watchContractEvent: vi.fn().mockReturnValue(vi.fn()),
    waitForTransactionReceipt: vi.fn(),
    ...overrides,
  } as unknown as PublicClient
}

function makeWalletClient(overrides: Partial<WalletClient> = {}): WalletClient {
  return {
    getAddresses: vi.fn().mockResolvedValue([ALICE]),
    writeContract: vi.fn().mockResolvedValue(MOCK_HASH),
    chain: null,
    ...overrides,
  } as unknown as WalletClient
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NdiddTokenClient', () => {
  let publicClient: PublicClient
  let walletClient: WalletClient
  let client: NdiddTokenClient

  beforeEach(() => {
    publicClient = makePublicClient()
    walletClient = makeWalletClient()
    client = new NdiddTokenClient(publicClient, CONTRACT_ADDRESS, walletClient)
  })

  // ── Read methods ──────────────────────────────────────────────────────────

  describe('getBalance', () => {
    it('calls readContract with balanceOf and the given address', async () => {
      const expected = 500n * 10n ** 18n
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(expected)

      const result = await client.getBalance(ALICE)

      expect(publicClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: CONTRACT_ADDRESS,
          functionName: 'balanceOf',
          args: [ALICE],
        }),
      )
      expect(result).toBe(expected)
    })
  })

  describe('getTotalSupply', () => {
    it('calls readContract with totalSupply', async () => {
      const expected = 1_000_000n * 10n ** 18n
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(expected)

      const result = await client.getTotalSupply()

      expect(publicClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: 'totalSupply' }),
      )
      expect(result).toBe(expected)
    })
  })

  describe('getAllowance', () => {
    it('calls readContract with allowance, owner and spender', async () => {
      const expected = 100n
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(expected)

      const result = await client.getAllowance(ALICE, BOB)

      expect(publicClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'allowance',
          args: [ALICE, BOB],
        }),
      )
      expect(result).toBe(expected)
    })
  })

  describe('isPaused', () => {
    it('returns true when the contract is paused', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(true)
      expect(await client.isPaused()).toBe(true)
    })

    it('returns false when the contract is not paused', async () => {
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(false)
      expect(await client.isPaused()).toBe(false)
    })
  })

  describe('hasRole', () => {
    it('calls readContract with hasRole', async () => {
      const role = '0x0000000000000000000000000000000000000000000000000000000000000000'
      vi.mocked(publicClient.readContract).mockResolvedValueOnce(true)

      const result = await client.hasRole(role, ALICE)

      expect(publicClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'hasRole',
          args: [role, ALICE],
        }),
      )
      expect(result).toBe(true)
    })
  })

  describe('getBalanceFormatted', () => {
    it('returns balance formatted with decimals', async () => {
      vi.mocked(publicClient.readContract)
        .mockResolvedValueOnce(1_500n * 10n ** 18n) // balanceOf
        .mockResolvedValueOnce(18)                   // decimals

      const result = await client.getBalanceFormatted(ALICE)
      expect(result).toBe('1500')
    })
  })

  // ── Write methods ─────────────────────────────────────────────────────────

  describe('transfer', () => {
    it('calls writeContract with transfer and returns the tx hash', async () => {
      const hash = await client.transfer(BOB, 100n)

      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: CONTRACT_ADDRESS,
          functionName: 'transfer',
          args: [BOB, 100n],
          account: ALICE,
        }),
      )
      expect(hash).toBe(MOCK_HASH)
    })
  })

  describe('approve', () => {
    it('calls writeContract with approve', async () => {
      const hash = await client.approve(BOB, 200n)

      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'approve',
          args: [BOB, 200n],
        }),
      )
      expect(hash).toBe(MOCK_HASH)
    })
  })

  describe('mint', () => {
    it('calls writeContract with mint', async () => {
      const hash = await client.mint(BOB, 1000n)

      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'mint',
          args: [BOB, 1000n],
        }),
      )
      expect(hash).toBe(MOCK_HASH)
    })
  })

  describe('burn', () => {
    it('calls writeContract with burn', async () => {
      const hash = await client.burn(50n)

      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'burn',
          args: [50n],
        }),
      )
      expect(hash).toBe(MOCK_HASH)
    })
  })

  describe('pause / unpause', () => {
    it('calls pause', async () => {
      await client.pause()
      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: 'pause' }),
      )
    })

    it('calls unpause', async () => {
      await client.unpause()
      expect(walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: 'unpause' }),
      )
    })
  })

  // ── Guard: no WalletClient ────────────────────────────────────────────────

  describe('write operations without WalletClient', () => {
    it('throws when no walletClient is provided', async () => {
      const readOnlyClient = new NdiddTokenClient(publicClient, CONTRACT_ADDRESS)
      await expect(readOnlyClient.transfer(BOB, 1n)).rejects.toThrow(
        'WalletClient is required for write operations',
      )
    })
  })

  // ── Event watching ────────────────────────────────────────────────────────

  describe('watchTransfers', () => {
    it('registers a watchContractEvent listener and returns an unsubscribe fn', () => {
      const unsubscribeMock = vi.fn()
      vi.mocked(publicClient.watchContractEvent).mockReturnValue(unsubscribeMock)

      const callback = vi.fn()
      const unsubscribe = client.watchTransfers(callback)

      expect(publicClient.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          address: CONTRACT_ADDRESS,
          eventName: 'Transfer',
        }),
      )
      expect(typeof unsubscribe).toBe('function')

      unsubscribe()
      expect(unsubscribeMock).toHaveBeenCalledOnce()
    })

    it('invokes the callback when Transfer logs arrive', () => {
      let capturedHandler: ((logs: unknown[]) => void) | undefined

      vi.mocked(publicClient.watchContractEvent).mockImplementation(
        (opts: { onLogs: (logs: unknown[]) => void }) => {
          capturedHandler = opts.onLogs
          return vi.fn()
        },
      )

      const callback = vi.fn()
      client.watchTransfers(callback)

      capturedHandler?.([
        {
          args: { from: ALICE, to: BOB, value: 42n },
        },
      ])

      expect(callback).toHaveBeenCalledOnce()
      expect(callback).toHaveBeenCalledWith({ from: ALICE, to: BOB, amount: 42n })
    })
  })
})
