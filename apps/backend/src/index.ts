import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import jwt from "@fastify/jwt";

import { config } from "./lib/config.js";
import prismaPlugin from "./plugins/prisma.js";
import redisPlugin from "./plugins/redis.js";

import healthRoute from "./routes/health.js";
import tokensRoute from "./routes/tokens.js";
import nftsRoute from "./routes/nfts.js";
import vaultRoute from "./routes/vault.js";
import governanceRoute from "./routes/governance.js";
import webhooksRoute from "./routes/webhooks.js";

import { startIndexer } from "./indexer/index.js";
import { startWebhookWorker } from "./workers/webhookWorker.js";
import { startNotificationWorker } from "./workers/notificationWorker.js";

async function buildApp() {
  const isDev = config.NODE_ENV === "development";
  const loggerOptions = isDev
    ? {
        level: "info" as const,
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : { level: config.NODE_ENV === "test" ? ("silent" as const) : ("info" as const) };

  const app = Fastify({
    logger: loggerOptions,
    trustProxy: true,
  });

  // ─── Security & utility plugins ───────────────────────────────────────────

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(cors, {
    origin: config.CORS_ORIGINS === "*" ? true : config.CORS_ORIGINS.split(","),
    credentials: true,
  });

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    errorResponseBuilder: (_req, context) => ({
      error: "Too Many Requests",
      message: `Rate limit exceeded. Retry after ${Math.ceil(context.ttl / 1000)}s`,
      statusCode: 429,
    }),
  });

  await app.register(jwt, {
    secret: config.JWT_SECRET,
  });

  // ─── OpenAPI / Swagger ────────────────────────────────────────────────────

  await app.register(swagger, {
    openapi: {
      openapi: "3.0.0",
      info: {
        title: "NDIDD Backend API",
        description: "Blockchain event indexer and REST API",
        version: "0.1.0",
      },
      servers: [{ url: `http://localhost:${config.PORT}` }],
      tags: [
        { name: "Health", description: "Health check endpoints" },
        { name: "Tokens", description: "ERC-20 token transfers" },
        { name: "NFTs", description: "ERC-721 NFT mints" },
        { name: "Vault", description: "ERC-4626 vault events" },
        { name: "Governance", description: "On-chain governance" },
        { name: "Webhooks", description: "Webhook management" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });

  // ─── Data plugins ─────────────────────────────────────────────────────────

  await app.register(prismaPlugin);
  await app.register(redisPlugin);

  // ─── Routes ───────────────────────────────────────────────────────────────

  await app.register(healthRoute, { prefix: "/api/v1" });
  await app.register(tokensRoute, { prefix: "/api/v1/tokens" });
  await app.register(nftsRoute, { prefix: "/api/v1/nfts" });
  await app.register(vaultRoute, { prefix: "/api/v1/vault" });
  await app.register(governanceRoute, { prefix: "/api/v1/governance" });
  await app.register(webhooksRoute, { prefix: "/api/v1/webhooks" });

  // ─── Global error handler ─────────────────────────────────────────────────

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.code(statusCode).send({
      error: error.name,
      message: error.message,
      statusCode,
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: "Not Found", message: "Route not found", statusCode: 404 });
  });

  return app;
}

async function main() {
  const app = await buildApp();

  // Start background workers (non-blocking)
  if (config.NODE_ENV !== "test") {
    startWebhookWorker();
    startNotificationWorker();

    // Start indexer (non-blocking; errors are logged internally)
    startIndexer().catch((err: unknown) => {
      app.log.error({ err }, "Indexer fatal error");
    });
  }

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`🚀 Server running at http://${config.HOST}:${config.PORT}`);
    app.log.info(`📖 Swagger UI: http://${config.HOST}:${config.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

export { buildApp };
export default main;

// Auto-start unless imported as a module (e.g. in tests)
const isMain = process.argv[1]?.endsWith("index.js") || process.argv[1]?.endsWith("index.ts");
if (isMain) {
  await main();
}
