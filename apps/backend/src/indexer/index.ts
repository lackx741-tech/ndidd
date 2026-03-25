import { PrismaClient } from "@prisma/client";
import { parseAbiItem, type Log } from "viem";
import { getPublicClient } from "../lib/viem.js";
import { config } from "../lib/config.js";
import { processTransferEvent, type TransferEventArgs } from "./tokenIndexer.js";
import { webhookQueue } from "../queues/index.js";

const prisma = new PrismaClient();

// ─── ABI fragments ─────────────────────────────────────────────────────────────

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

const NFT_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);

const DEPOSIT_EVENT = parseAbiItem(
  "event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares)"
);

const WITHDRAW_EVENT = parseAbiItem(
  "event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)"
);

const PROPOSAL_CREATED_EVENT = parseAbiItem(
  "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description)"
);

const VOTE_CAST_EVENT = parseAbiItem(
  "event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)"
);

// ─── Main indexer ──────────────────────────────────────────────────────────────

export async function startIndexer(): Promise<void> {
  const chainId = config.DEFAULT_CHAIN_ID;
  const client = getPublicClient(chainId);

  // Restore last synced block
  let syncState = await prisma.blockSyncState.findUnique({ where: { chainId } });
  const latestBlock = await client.getBlockNumber();

  const startBlock =
    syncState?.blockNumber !== undefined
      ? syncState.blockNumber + 1n
      : BigInt(config.INDEXER_START_BLOCK);

  console.info(
    `[Indexer] Starting on chain ${chainId} from block ${startBlock} (latest: ${latestBlock})`
  );

  // Backfill missed blocks
  if (startBlock <= latestBlock) {
    await syncRange(chainId, startBlock, latestBlock);
  }

  // Update sync state
  syncState = await prisma.blockSyncState.upsert({
    where: { chainId },
    create: { chainId, blockNumber: latestBlock },
    update: { blockNumber: latestBlock },
  });

  // Poll for new blocks
  setInterval(async () => {
    try {
      const current = await client.getBlockNumber();
      const from = syncState!.blockNumber + 1n;

      if (from > current) return;

      await syncRange(chainId, from, current);

      syncState = await prisma.blockSyncState.update({
        where: { chainId },
        data: { blockNumber: current },
      });
    } catch (err) {
      console.error("[Indexer] Poll error:", err);
    }
  }, config.INDEXER_POLL_INTERVAL_MS);
}

async function syncRange(chainId: number, fromBlock: bigint, toBlock: bigint): Promise<void> {
  const BATCH = BigInt(config.INDEXER_BLOCK_BATCH_SIZE);

  for (let block = fromBlock; block <= toBlock; block += BATCH) {
    const end = block + BATCH - 1n < toBlock ? block + BATCH - 1n : toBlock;
    await Promise.all([
      indexTokenTransfers(chainId, block, end),
      indexNFTMints(chainId, block, end),
      indexVaultEvents(chainId, block, end),
      indexGovernanceEvents(chainId, block, end),
    ]);
  }
}

// ─── Token transfers ───────────────────────────────────────────────────────────

async function indexTokenTransfers(
  chainId: number,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  if (!config.TOKEN_CONTRACT_ADDRESS) return;
  const client = getPublicClient(chainId);

  const logs = await client.getLogs({
    address: config.TOKEN_CONTRACT_ADDRESS as `0x${string}`,
    event: TRANSFER_EVENT,
    fromBlock,
    toBlock,
  });

  for (const log of logs) {
    await processTransferEvent(
      log as Log & { args: TransferEventArgs; blockNumber: bigint },
      chainId
    );
  }
}

// ─── NFT mints ─────────────────────────────────────────────────────────────────

async function indexNFTMints(
  chainId: number,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  if (!config.NFT_CONTRACT_ADDRESS) return;
  const client = getPublicClient(chainId);

  const logs = await client.getLogs({
    address: config.NFT_CONTRACT_ADDRESS as `0x${string}`,
    event: NFT_TRANSFER_EVENT,
    fromBlock,
    toBlock,
  });

  for (const log of logs) {
    const { transactionHash, blockNumber, logIndex, args } = log as Log & {
      args: { from: `0x${string}`; to: `0x${string}`; tokenId: bigint };
      blockNumber: bigint;
    };

    if (!transactionHash || blockNumber === undefined || blockNumber === null || logIndex === undefined || logIndex === null) continue;

    // Only mints (from zero address)
    if (args.from !== "0x0000000000000000000000000000000000000000") continue;

    const block = await client.getBlock({ blockNumber });

    await prisma.nFTMint.upsert({
      where: { txHash_logIndex: { txHash: transactionHash, logIndex } },
      update: {},
      create: {
        txHash: transactionHash,
        blockNumber,
        blockTimestamp: new Date(Number(block.timestamp) * 1000),
        chainId,
        toAddress: args.to.toLowerCase(),
        tokenId: args.tokenId.toString(),
        logIndex,
      },
    });

    await dispatchWebhookEvent("nft.mint", {
      txHash: transactionHash,
      chainId,
      to: args.to,
      tokenId: args.tokenId.toString(),
    });
  }
}

// ─── Vault events ──────────────────────────────────────────────────────────────

async function indexVaultEvents(
  chainId: number,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  if (!config.VAULT_CONTRACT_ADDRESS) return;
  const client = getPublicClient(chainId);

  const [depositLogs, withdrawLogs] = await Promise.all([
    client.getLogs({
      address: config.VAULT_CONTRACT_ADDRESS as `0x${string}`,
      event: DEPOSIT_EVENT,
      fromBlock,
      toBlock,
    }),
    client.getLogs({
      address: config.VAULT_CONTRACT_ADDRESS as `0x${string}`,
      event: WITHDRAW_EVENT,
      fromBlock,
      toBlock,
    }),
  ]);

  for (const log of depositLogs) {
    const { transactionHash, blockNumber, logIndex, args } = log as Log & {
      args: { caller: `0x${string}`; owner: `0x${string}`; assets: bigint; shares: bigint };
      blockNumber: bigint;
    };

    if (!transactionHash || blockNumber === undefined || blockNumber === null || logIndex === undefined || logIndex === null) continue;

    const block = await client.getBlock({ blockNumber });

    await prisma.vaultDeposit.upsert({
      where: { txHash_logIndex: { txHash: transactionHash, logIndex } },
      update: {},
      create: {
        txHash: transactionHash,
        blockNumber,
        blockTimestamp: new Date(Number(block.timestamp) * 1000),
        chainId,
        caller: args.caller.toLowerCase(),
        owner: args.owner.toLowerCase(),
        assets: args.assets.toString(),
        shares: args.shares.toString(),
        logIndex,
      },
    });

    await dispatchWebhookEvent("vault.deposit", {
      txHash: transactionHash,
      chainId,
      caller: args.caller,
      owner: args.owner,
      assets: args.assets.toString(),
      shares: args.shares.toString(),
    });
  }

  for (const log of withdrawLogs) {
    const { transactionHash, blockNumber, logIndex, args } = log as Log & {
      args: { caller: `0x${string}`; receiver: `0x${string}`; owner: `0x${string}`; assets: bigint; shares: bigint };
      blockNumber: bigint;
    };

    if (!transactionHash || blockNumber === undefined || blockNumber === null || logIndex === undefined || logIndex === null) continue;

    const block = await client.getBlock({ blockNumber });

    await prisma.vaultWithdrawal.upsert({
      where: { txHash_logIndex: { txHash: transactionHash, logIndex } },
      update: {},
      create: {
        txHash: transactionHash,
        blockNumber,
        blockTimestamp: new Date(Number(block.timestamp) * 1000),
        chainId,
        caller: args.caller.toLowerCase(),
        owner: args.owner.toLowerCase(),
        assets: args.assets.toString(),
        shares: args.shares.toString(),
        logIndex,
      },
    });

    await dispatchWebhookEvent("vault.withdrawal", {
      txHash: transactionHash,
      chainId,
      caller: args.caller,
      owner: args.owner,
      assets: args.assets.toString(),
      shares: args.shares.toString(),
    });
  }
}

// ─── Governance events ─────────────────────────────────────────────────────────

async function indexGovernanceEvents(
  chainId: number,
  fromBlock: bigint,
  toBlock: bigint
): Promise<void> {
  if (!config.GOVERNANCE_CONTRACT_ADDRESS) return;
  const client = getPublicClient(chainId);

  const [proposalLogs, voteLogs] = await Promise.all([
    client.getLogs({
      address: config.GOVERNANCE_CONTRACT_ADDRESS as `0x${string}`,
      event: PROPOSAL_CREATED_EVENT,
      fromBlock,
      toBlock,
    }),
    client.getLogs({
      address: config.GOVERNANCE_CONTRACT_ADDRESS as `0x${string}`,
      event: VOTE_CAST_EVENT,
      fromBlock,
      toBlock,
    }),
  ]);

  for (const log of proposalLogs) {
    const { transactionHash, blockNumber, args } = log as Log & {
      args: {
        proposalId: bigint;
        proposer: `0x${string}`;
        description: string;
        startBlock: bigint;
        endBlock: bigint;
      };
      blockNumber: bigint;
    };

    if (!transactionHash || blockNumber === undefined || blockNumber === null) continue;

    await prisma.governanceProposal.upsert({
      where: { proposalId: args.proposalId.toString() },
      update: {},
      create: {
        proposalId: args.proposalId.toString(),
        chainId,
        proposer: args.proposer.toLowerCase(),
        description: args.description,
        startBlock: args.startBlock,
        endBlock: args.endBlock,
        status: "PENDING",
        txHash: transactionHash,
      },
    });

    await dispatchWebhookEvent("governance.proposal", {
      proposalId: args.proposalId.toString(),
      chainId,
      proposer: args.proposer,
      description: args.description,
    });
  }

  for (const log of voteLogs) {
    const { transactionHash, blockNumber, args } = log as Log & {
      args: {
        voter: `0x${string}`;
        proposalId: bigint;
        support: number;
        weight: bigint;
        reason: string;
      };
      blockNumber: bigint;
    };

    if (!transactionHash || blockNumber === undefined || blockNumber === null) continue;

    await prisma.governanceVote.upsert({
      where: {
        proposalId_voter: {
          proposalId: args.proposalId.toString(),
          voter: args.voter.toLowerCase(),
        },
      },
      update: { weight: args.weight.toString() },
      create: {
        proposalId: args.proposalId.toString(),
        voter: args.voter.toLowerCase(),
        support: args.support,
        weight: args.weight.toString(),
        reason: args.reason || null,
        txHash: transactionHash,
        blockNumber,
      },
    });

    await dispatchWebhookEvent("governance.vote", {
      proposalId: args.proposalId.toString(),
      chainId,
      voter: args.voter,
      support: args.support,
      weight: args.weight.toString(),
    });
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function dispatchWebhookEvent(
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const activeWebhooks = await prisma.webhookEndpoint.findMany({
    where: { isActive: true, events: { has: event } },
  });

  for (const webhook of activeWebhooks) {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload,
        attempts: 0,
        success: false,
      },
    });

    await webhookQueue.add("deliver", {
      webhookId: webhook.id,
      deliveryId: delivery.id,
      url: webhook.url,
      secret: webhook.secret,
      event,
      payload,
      attempt: 0,
    });
  }
}
