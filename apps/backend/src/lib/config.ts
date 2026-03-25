import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default("0.0.0.0"),

  DATABASE_URL: z.string().url(),

  REDIS_URL: z.string().default("redis://localhost:6379"),

  JWT_SECRET: z.string().min(32),

  // Blockchain RPC endpoints (comma-separated for failover)
  RPC_URL_1: z.string().url().optional(),       // Ethereum mainnet
  RPC_URL_137: z.string().url().optional(),     // Polygon
  RPC_URL_42161: z.string().url().optional(),   // Arbitrum
  RPC_URL_10: z.string().url().optional(),      // Optimism
  RPC_URL_8453: z.string().url().optional(),    // Base

  // Default chain to index
  DEFAULT_CHAIN_ID: z.coerce.number().int().default(1),

  // Contract addresses
  TOKEN_CONTRACT_ADDRESS: z.string().optional(),
  NFT_CONTRACT_ADDRESS: z.string().optional(),
  VAULT_CONTRACT_ADDRESS: z.string().optional(),
  GOVERNANCE_CONTRACT_ADDRESS: z.string().optional(),

  // Indexer config
  INDEXER_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(12_000),
  INDEXER_BLOCK_BATCH_SIZE: z.coerce.number().int().min(1).max(10_000).default(500),
  INDEXER_START_BLOCK: z.coerce.number().int().min(0).default(0),

  // CORS
  CORS_ORIGINS: z.string().default("*"),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(200),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),

  // Webhook delivery
  WEBHOOK_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10_000),
  WEBHOOK_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
