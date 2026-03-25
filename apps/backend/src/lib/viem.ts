import {
  createPublicClient,
  http,
  type PublicClient,
  type Chain,
} from "viem";
import {
  mainnet,
  polygon,
  arbitrum,
  optimism,
  base,
  sepolia,
} from "viem/chains";
import { config } from "./config.js";

const CHAIN_MAP: Record<number, Chain> = {
  1: mainnet,
  137: polygon,
  42161: arbitrum,
  10: optimism,
  8453: base,
  11155111: sepolia,
};

const RPC_ENV_MAP: Record<number, string | undefined> = {
  1: config.RPC_URL_1,
  137: config.RPC_URL_137,
  42161: config.RPC_URL_42161,
  10: config.RPC_URL_10,
  8453: config.RPC_URL_8453,
};

const clientCache = new Map<number, PublicClient>();

export function getPublicClient(chainId: number): PublicClient {
  const cached = clientCache.get(chainId);
  if (cached) return cached;

  const chain = CHAIN_MAP[chainId];
  if (!chain) {
    throw new Error(`Unsupported chainId: ${chainId}`);
  }

  const rpcUrl = RPC_ENV_MAP[chainId];
  const transport = rpcUrl ? http(rpcUrl) : http();

  const client = createPublicClient({ chain, transport }) as PublicClient;
  clientCache.set(chainId, client);
  return client;
}

export function getSupportedChainIds(): number[] {
  return Object.keys(CHAIN_MAP).map(Number);
}
