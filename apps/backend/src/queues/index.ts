import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../lib/config.js";

const connection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export interface WebhookJobData {
  webhookId: string;
  deliveryId: string;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
  attempt: number;
}

export interface NotificationJobData {
  notificationId: string;
  type: string;
  recipient: string;
  subject: string;
  body: string;
}

export interface IndexerJobData {
  chainId: number;
  fromBlock: number;
  toBlock: number;
  jobType: "backfill" | "realtime";
}

export const webhookQueue = new Queue<WebhookJobData>("webhooks", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

export const notificationQueue = new Queue<NotificationJobData>("notifications", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export const indexerQueue = new Queue<IndexerJobData>("indexer", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export { connection as redisConnection };
