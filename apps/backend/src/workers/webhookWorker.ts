import { Worker, type Job } from "bullmq";
import { createHmac } from "crypto";
import { PrismaClient } from "@prisma/client";
import { redisConnection, type WebhookJobData } from "../queues/index.js";
import { config } from "../lib/config.js";

const prisma = new PrismaClient();

async function deliverWebhook(job: Job<WebhookJobData>): Promise<void> {
  const { deliveryId, url, secret, event, payload } = job.data;

  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  let statusCode: number | null = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.WEBHOOK_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Delivery": deliveryId,
      },
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    statusCode = response.status;
    success = response.ok;

    if (!success) {
      throw new Error(`Webhook delivery failed with status ${statusCode}`);
    }
  } catch (err) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        attempts: { increment: 1 },
        statusCode,
        lastAttemptAt: new Date(),
        success: false,
      },
    });
    throw err; // Re-throw so BullMQ can retry
  }

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      attempts: { increment: 1 },
      statusCode,
      lastAttemptAt: new Date(),
      success: true,
    },
  });
}

export function startWebhookWorker(): Worker<WebhookJobData> {
  const worker = new Worker<WebhookJobData>("webhooks", deliverWebhook, {
    connection: redisConnection,
    concurrency: 10,
  });

  worker.on("completed", (job) => {
    console.info(`[WebhookWorker] Delivered job ${job.id} for webhook ${job.data.webhookId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[WebhookWorker] Failed job ${job?.id}: ${err.message}`);
  });

  return worker;
}
