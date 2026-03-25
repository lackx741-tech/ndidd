import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

const vaultRoute: FastifyPluginAsync = async (fastify) => {
  // GET /deposits
  fastify.get(
    "/deposits",
    {
      schema: {
        tags: ["Vault"],
        summary: "List vault deposits",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const query = paginationSchema.parse(request.query);
      const skip = (query.page - 1) * query.limit;

      const [deposits, total] = await Promise.all([
        fastify.prisma.vaultDeposit.findMany({
          skip,
          take: query.limit,
          orderBy: { blockNumber: "desc" },
        }),
        fastify.prisma.vaultDeposit.count(),
      ]);

      return reply.send({
        data: deposits.map(serializeVaultEvent),
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      });
    }
  );

  // GET /withdrawals
  fastify.get(
    "/withdrawals",
    {
      schema: {
        tags: ["Vault"],
        summary: "List vault withdrawals",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const query = paginationSchema.parse(request.query);
      const skip = (query.page - 1) * query.limit;

      const [withdrawals, total] = await Promise.all([
        fastify.prisma.vaultWithdrawal.findMany({
          skip,
          take: query.limit,
          orderBy: { blockNumber: "desc" },
        }),
        fastify.prisma.vaultWithdrawal.count(),
      ]);

      return reply.send({
        data: withdrawals.map(serializeVaultEvent),
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      });
    }
  );

  // GET /stats
  fastify.get(
    "/stats",
    {
      schema: {
        tags: ["Vault"],
        summary: "Vault statistics — TVL, volume, APY estimate",
      },
    },
    async (_request, reply) => {
      const [depositAgg, withdrawalAgg, depositCount, withdrawalCount] = await Promise.all([
        fastify.prisma.$queryRaw<Array<{ total: string }>>`
          SELECT SUM(CAST(assets AS NUMERIC))::TEXT AS total FROM vault_deposits`,
        fastify.prisma.$queryRaw<Array<{ total: string }>>`
          SELECT SUM(CAST(assets AS NUMERIC))::TEXT AS total FROM vault_withdrawals`,
        fastify.prisma.vaultDeposit.count(),
        fastify.prisma.vaultWithdrawal.count(),
      ]);

      const totalDeposits = BigInt(depositAgg[0]?.total ?? "0");
      const totalWithdrawals = BigInt(withdrawalAgg[0]?.total ?? "0");
      const tvl = totalDeposits - totalWithdrawals;

      return reply.send({
        tvl: tvl.toString(),
        totalDeposits: totalDeposits.toString(),
        totalWithdrawals: totalWithdrawals.toString(),
        depositCount,
        withdrawalCount,
        // APY is a placeholder; real computation requires price oracle + time-series data
        apyEstimate: null,
      });
    }
  );

  // GET /positions/:address
  fastify.get<{ Params: { address: string } }>(
    "/positions/:address",
    {
      schema: {
        tags: ["Vault"],
        summary: "Get user vault position",
        params: {
          type: "object",
          properties: { address: { type: "string" } },
          required: ["address"],
        },
      },
    },
    async (request, reply) => {
      const { address } = request.params;
      const addr = address.toLowerCase();

      const [deposits, withdrawals] = await Promise.all([
        fastify.prisma.vaultDeposit.findMany({ where: { owner: addr } }),
        fastify.prisma.vaultWithdrawal.findMany({ where: { owner: addr } }),
      ]);

      type VaultRow = { assets: string; shares: string };
      const totalDeposited = (deposits as VaultRow[]).reduce((acc, d) => acc + BigInt(d.assets), 0n);
      const totalWithdrawn = (withdrawals as VaultRow[]).reduce((acc, w) => acc + BigInt(w.assets), 0n);
      const totalShares = (deposits as VaultRow[]).reduce((acc, d) => acc + BigInt(d.shares), 0n)
        - (withdrawals as VaultRow[]).reduce((acc, w) => acc + BigInt(w.shares), 0n);

      return reply.send({
        address,
        totalDeposited: totalDeposited.toString(),
        totalWithdrawn: totalWithdrawn.toString(),
        netAssets: (totalDeposited - totalWithdrawn).toString(),
        shares: totalShares.toString(),
        depositCount: deposits.length,
        withdrawalCount: withdrawals.length,
      });
    }
  );
};

type VaultEvent = {
  id: string;
  txHash: string;
  blockNumber: bigint;
  blockTimestamp: Date;
  chainId: number;
  caller: string;
  owner: string;
  assets: string;
  shares: string;
  logIndex: number;
  createdAt: Date;
};

function serializeVaultEvent(e: VaultEvent) {
  return {
    ...e,
    blockNumber: e.blockNumber.toString(),
    blockTimestamp: e.blockTimestamp.toISOString(),
    createdAt: e.createdAt.toISOString(),
  };
}

export default vaultRoute;
