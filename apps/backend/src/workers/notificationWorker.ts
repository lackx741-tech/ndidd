import { Worker, type Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { redisConnection, type NotificationJobData } from "../queues/index.js";

const prisma = new PrismaClient();

async function processNotification(job: Job<NotificationJobData>): Promise<void> {
  const { notificationId, type, recipient, subject, body } = job.data;

  try {
    // In production, replace this with an actual email provider (SES, SendGrid, Resend, etc.)
    console.info(
      `[NotificationWorker] Sending ${type} notification to ${recipient}: "${subject}"`
    );
    console.info(`[NotificationWorker] Body: ${body}`);

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        sent: true,
        sentAt: new Date(),
        error: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    await prisma.notification.update({
      where: { id: notificationId },
      data: { error: message },
    });

    throw err;
  }
}

export function startNotificationWorker(): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>("notifications", processNotification, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on("completed", (job) => {
    console.info(`[NotificationWorker] Sent notification ${job.data.notificationId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[NotificationWorker] Failed notification ${job?.data.notificationId}: ${err.message}`);
  });

  return worker;
}
