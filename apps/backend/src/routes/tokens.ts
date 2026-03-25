import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPublicClient } from "../lib/viem.js";
import { config } from "../lib/config.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  from: z.string().optional(),
  to: z.string().optional(),
});

const tokensRoute: FastifyPluginAsync = async (fastify) => {
  // GET /transfers
  fastify.get(
    "/transfers",
    {
      schema: {
        tags: ["Tokens"],
        summary: "List token transfers",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
            from: { type: "string" },
            to: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const query = paginationSchema.parse(request.query);
      const skip = (query.page - 1) * query.limit;

      const where = {
        ...(query.from && { fromAddress: query.from.toLowerCase() }),
        ...(query.to && { toAddress: query.to.toLowerCase() }),
      };

      const [transfers, total] = await Promise.all([
        fastify.prisma.tokenTransfer.findMany({
          where,
          skip,
          take: query.limit,
          orderBy: { blockNumber: "desc" },
        }),
        fastify.prisma.tokenTransfer.count({ where }),
      ]);

      return reply.send({
        data: transfers.map(serializeTransfer),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      });
    }
  );

  // GET /transfers/:txHash
  fastify.get<{ Params: { txHash: string } }>(
    "/transfers/:txHash",
    {
      schema: {
        tags: ["Tokens"],
        summary: "Get transfer by tx hash",
        params: {
          type: "object",
          properties: { txHash: { type: "string" } },
          required: ["txHash"],
        },
      },
    },
    async (request, reply) => {
      const { txHash } = request.params;

      const transfers = await fastify.prisma.tokenTransfer.findMany({
        where: { txHash },
        orderBy: { logIndex: "asc" },
      });

      if (transfers.length === 0) {
        return reply.code(404).send({ error: "Transfer not found" });
      }

      return reply.send({ data: transfers.map(serializeTransfer) });
    }
  );

  // GET /holders/:address/balance
  fastify.get<{ Params: { address: string } }>(
    "/holders/:address/balance",
    {
      schema: {
        tags: ["Tokens"],
        summary: "Get on-chain token balance for address",
        params: {
          type: "object",
          properties: { address: { type: "string" } },
          required: ["address"],
        },
      },
    },
    async (request, reply) => {
      const { address } = request.params;

      if (!config.TOKEN_CONTRACT_ADDRESS) {
        return reply.code(503).send({ error: "Token contract address not configured" });
      }

      try {
        const client = getPublicClient(config.DEFAULT_CHAIN_ID);
        const balance = await client.readContract({
          address: config.TOKEN_CONTRACT_ADDRESS as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        });

        return reply.send({
          address,
          balance: balance.toString(),
          chainId: config.DEFAULT_CHAIN_ID,
        });
      } catch (err) {
        fastify.log.error({ err }, "Failed to read on-chain balance");
        return reply.code(502).send({ error: "Failed to fetch on-chain balance" });
      }
    }
  );

  // GET /stats
  fastify.get(
    "/stats",
    {
      schema: {
        tags: ["Tokens"],
        summary: "Token transfer statistics",
      },
    },
    async (_request, reply) => {
      const [totalTransfers, senders, receivers] = await Promise.all([
        fastify.prisma.tokenTransfer.count(),
        fastify.prisma.tokenTransfer.groupBy({
          by: ["fromAddress"],
          _count: true,
        }),
        fastify.prisma.tokenTransfer.groupBy({
          by: ["toAddress"],
          _count: true,
        }),
      ]);

      const uniqueHolders = new Set([
        ...senders.map((s: { fromAddress: string }) => s.fromAddress),
        ...receivers.map((r: { toAddress: string }) => r.toAddress),
      ]).size;

      const volumeResult = await fastify.prisma.$queryRaw<
        Array<{ total: string }>
      >`SELECT SUM(CAST(amount AS NUMERIC))::TEXT AS total FROM token_transfers`;

      return reply.send({
        totalTransfers,
        uniqueHolders,
        totalVolume: volumeResult[0]?.total ?? "0",
      });
    }
  );
};

function serializeTransfer(t: {
  id: string;
  txHash: string;
  blockNumber: bigint;
  blockTimestamp: Date;
  chainId: number;
  fromAddress: string;
  toAddress: string;
  amount: string;
  logIndex: number;
  createdAt: Date;
}) {
  return {
    ...t,
    blockNumber: t.blockNumber.toString(),
    blockTimestamp: t.blockTimestamp.toISOString(),
    createdAt: t.createdAt.toISOString(),
  };
}

const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default tokensRoute;
