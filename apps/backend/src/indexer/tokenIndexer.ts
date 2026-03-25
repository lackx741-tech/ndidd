import { PrismaClient } from "@prisma/client";
import { type Log, parseAbiItem } from "viem";
import { getPublicClient } from "../lib/viem.js";
import { webhookQueue } from "../queues/index.js";

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

const prisma = new PrismaClient();

export interface TransferEventArgs {
  from: `0x${string}`;
  to: `0x${string}`;
  value: bigint;
}

export async function processTransferEvent(
  log: Log & { args: TransferEventArgs; blockNumber: bigint },
  chainId: number
): Promise<void> {
  const { transactionHash, blockNumber, logIndex, args } = log;

  if (
    !transactionHash ||
    blockNumber === undefined ||
    blockNumber === null ||
    logIndex === undefined ||
    logIndex === null
  ) {
    return;
  }

  const client = getPublicClient(chainId);
  const block = await client.getBlock({ blockNumber });

  try {
    await prisma.tokenTransfer.upsert({
      where: {
        txHash_logIndex: {
          txHash: transactionHash,
          logIndex,
        },
      },
      update: {},
      create: {
        txHash: transactionHash,
        blockNumber,
        blockTimestamp: new Date(Number(block.timestamp) * 1000),
        chainId,
        fromAddress: args.from.toLowerCase(),
        toAddress: args.to.toLowerCase(),
        amount: args.value.toString(),
        logIndex,
      },
    });

    // Notify webhooks about the new transfer
    await dispatchWebhookEvent("token.transfer", {
      txHash: transactionHash,
      blockNumber: blockNumber.toString(),
      chainId,
      from: args.from,
      to: args.to,
      amount: args.value.toString(),
    });
  } catch (err) {
    console.error("[TokenIndexer] Failed to store transfer event:", err);
    throw err;
  }
}

export async function backfillTransferEvents(
  chainId: number,
  contractAddress: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint
): Promise<number> {
  const client = getPublicClient(chainId);
  const BATCH = 500n;
  let processed = 0;

  for (let block = fromBlock; block <= toBlock; block += BATCH) {
    const end = block + BATCH - 1n < toBlock ? block + BATCH - 1n : toBlock;

    const logs = await client.getLogs({
      address: contractAddress,
      event: TRANSFER_EVENT,
      fromBlock: block,
      toBlock: end,
    });

    for (const log of logs) {
      await processTransferEvent(
        log as Log & { args: TransferEventArgs; blockNumber: bigint },
        chainId
      );
      processed++;
    }

    console.info(
      `[TokenIndexer] Backfilled blocks ${block}-${end} on chain ${chainId}: ${logs.length} events`
    );
  }

  return processed;
}

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
