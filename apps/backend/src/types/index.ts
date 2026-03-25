// ─── Pagination ────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Token ─────────────────────────────────────────────────────────────────────

export interface TokenTransfer {
  id: string;
  txHash: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
  fromAddress: string;
  toAddress: string;
  amount: string;
  logIndex: number;
  createdAt: string;
}

// ─── NFT ───────────────────────────────────────────────────────────────────────

export interface NFTMint {
  id: string;
  txHash: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
  toAddress: string;
  tokenId: string;
  uri: string | null;
  logIndex: number;
  createdAt: string;
}

// ─── Vault ─────────────────────────────────────────────────────────────────────

export interface VaultEvent {
  id: string;
  txHash: string;
  blockNumber: string;
  blockTimestamp: string;
  chainId: number;
  caller: string;
  owner: string;
  assets: string;
  shares: string;
  logIndex: number;
  createdAt: string;
}

export interface VaultStats {
  tvl: string;
  totalDeposits: string;
  totalWithdrawals: string;
  depositCount: number;
  withdrawalCount: number;
  apyEstimate: number | null;
}

// ─── Governance ────────────────────────────────────────────────────────────────

export type ProposalStatus =
  | "PENDING"
  | "ACTIVE"
  | "CANCELED"
  | "DEFEATED"
  | "SUCCEEDED"
  | "QUEUED"
  | "EXPIRED"
  | "EXECUTED";

export interface GovernanceProposal {
  id: string;
  proposalId: string;
  chainId: number;
  proposer: string;
  description: string;
  startBlock: string;
  endBlock: string;
  status: ProposalStatus;
  txHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface GovernanceVote {
  id: string;
  proposalId: string;
  voter: string;
  support: number;
  weight: string;
  reason: string | null;
  txHash: string;
  blockNumber: string;
  createdAt: string;
}

// ─── Webhooks ──────────────────────────────────────────────────────────────────

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: unknown;
  statusCode: number | null;
  attempts: number;
  lastAttemptAt: string | null;
  success: boolean;
  createdAt: string;
}

// ─── Health ────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  version: string;
  uptime: number;
  timestamp: string;
  database: "ok" | "error";
}

// ─── JWT ───────────────────────────────────────────────────────────────────────

export interface ApiKeyPayload {
  sub: string;
  role: "admin" | "user" | "api";
  apiKey?: string;
  iat: number;
  exp: number;
}
