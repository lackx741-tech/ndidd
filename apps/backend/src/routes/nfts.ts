import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { config } from "../lib/config.js";
import { getPublicClient } from "../lib/viem.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

const nftsRoute: FastifyPluginAsync = async (fastify) => {
  // GET /mints
  fastify.get(
    "/mints",
    {
      schema: {
        tags: ["NFTs"],
        summary: "List NFT mints",
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

      const [mints, total] = await Promise.all([
        fastify.prisma.nFTMint.findMany({
          skip,
          take: query.limit,
          orderBy: { blockNumber: "desc" },
        }),
        fastify.prisma.nFTMint.count(),
      ]);

      return reply.send({
        data: mints.map(serializeMint),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      });
    }
  );

  // GET /tokens/:tokenId
  fastify.get<{ Params: { tokenId: string } }>(
    "/tokens/:tokenId",
    {
      schema: {
        tags: ["NFTs"],
        summary: "Get NFT details by tokenId",
        params: {
          type: "object",
          properties: { tokenId: { type: "string" } },
          required: ["tokenId"],
        },
      },
    },
    async (request, reply) => {
      const { tokenId } = request.params;

      const mint = await fastify.prisma.nFTMint.findFirst({
        where: { tokenId },
        orderBy: { blockNumber: "asc" },
      });

      if (!mint) {
        return reply.code(404).send({ error: "NFT not found" });
      }

      // Attempt to fetch on-chain URI if configured
      let onChainUri: string | null = null;
      if (config.NFT_CONTRACT_ADDRESS) {
        try {
          const client = getPublicClient(mint.chainId);
          onChainUri = (await client.readContract({
            address: config.NFT_CONTRACT_ADDRESS as `0x${string}`,
            abi: ERC721_ABI,
            functionName: "tokenURI",
            args: [BigInt(tokenId)],
          })) as string;
        } catch {
          // non-fatal — use indexed URI
        }
      }

      return reply.send({
        data: { ...serializeMint(mint), onChainUri: onChainUri ?? mint.uri },
      });
    }
  );

  // GET /holders/:address
  fastify.get<{ Params: { address: string } }>(
    "/holders/:address",
    {
      schema: {
        tags: ["NFTs"],
        summary: "List NFTs owned by address",
        params: {
          type: "object",
          properties: { address: { type: "string" } },
          required: ["address"],
        },
      },
    },
    async (request, reply) => {
      const { address } = request.params;

      const mints = await fastify.prisma.nFTMint.findMany({
        where: { toAddress: address.toLowerCase() },
        orderBy: { blockNumber: "desc" },
      });

      return reply.send({ data: mints.map(serializeMint), total: mints.length });
    }
  );
};

function serializeMint(m: {
  id: string;
  txHash: string;
  blockNumber: bigint;
  blockTimestamp: Date;
  chainId: number;
  toAddress: string;
  tokenId: string;
  uri: string | null;
  logIndex: number;
  createdAt: Date;
}) {
  return {
    ...m,
    blockNumber: m.blockNumber.toString(),
    blockTimestamp: m.blockTimestamp.toISOString(),
    createdAt: m.createdAt.toISOString(),
  };
}

const ERC721_ABI = [
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default nftsRoute;
