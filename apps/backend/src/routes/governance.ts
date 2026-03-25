import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

const statusSchema = z.object({
  status: z
    .enum(["PENDING", "ACTIVE", "CANCELED", "DEFEATED", "SUCCEEDED", "QUEUED", "EXPIRED", "EXECUTED"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});

const governanceRoute: FastifyPluginAsync = async (fastify) => {
  // GET /proposals
  fastify.get(
    "/proposals",
    {
      schema: {
        tags: ["Governance"],
        summary: "List governance proposals",
        querystring: {
          type: "object",
          properties: {
            status: { type: "string" },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const query = statusSchema.parse(request.query);
      const skip = (query.page - 1) * query.limit;

      const where = query.status ? { status: query.status } : {};

      const [proposals, total] = await Promise.all([
        fastify.prisma.governanceProposal.findMany({
          where,
          skip,
          take: query.limit,
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { votes: true } } },
        }),
        fastify.prisma.governanceProposal.count({ where }),
      ]);

      return reply.send({
        data: proposals.map(serializeProposal),
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      });
    }
  );

  // GET /proposals/:proposalId
  fastify.get<{ Params: { proposalId: string } }>(
    "/proposals/:proposalId",
    {
      schema: {
        tags: ["Governance"],
        summary: "Get proposal details",
        params: {
          type: "object",
          properties: { proposalId: { type: "string" } },
          required: ["proposalId"],
        },
      },
    },
    async (request, reply) => {
      const { proposalId } = request.params;

      const proposal = await fastify.prisma.governanceProposal.findUnique({
        where: { proposalId },
        include: { _count: { select: { votes: true } } },
      });

      if (!proposal) {
        return reply.code(404).send({ error: "Proposal not found" });
      }

      return reply.send({ data: serializeProposal(proposal) });
    }
  );

  // GET /proposals/:proposalId/votes
  fastify.get<{ Params: { proposalId: string } }>(
    "/proposals/:proposalId/votes",
    {
      schema: {
        tags: ["Governance"],
        summary: "List votes for a proposal",
        params: {
          type: "object",
          properties: { proposalId: { type: "string" } },
          required: ["proposalId"],
        },
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
      const { proposalId } = request.params;
      const query = paginationSchema.parse(request.query);
      const skip = (query.page - 1) * query.limit;

      const [votes, total] = await Promise.all([
        fastify.prisma.governanceVote.findMany({
          where: { proposalId },
          skip,
          take: query.limit,
          orderBy: { blockNumber: "desc" },
        }),
        fastify.prisma.governanceVote.count({ where: { proposalId } }),
      ]);

      return reply.send({
        data: votes.map(serializeVote),
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      });
    }
  );

  // GET /voters/:address/votes
  fastify.get<{ Params: { address: string } }>(
    "/voters/:address/votes",
    {
      schema: {
        tags: ["Governance"],
        summary: "Get all votes cast by an address",
        params: {
          type: "object",
          properties: { address: { type: "string" } },
          required: ["address"],
        },
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
      const { address } = request.params;
      const query = paginationSchema.parse(request.query);
      const skip = (query.page - 1) * query.limit;

      const [votes, total] = await Promise.all([
        fastify.prisma.governanceVote.findMany({
          where: { voter: address.toLowerCase() },
          skip,
          take: query.limit,
          orderBy: { blockNumber: "desc" },
          include: { proposal: { select: { description: true, status: true } } },
        }),
        fastify.prisma.governanceVote.count({ where: { voter: address.toLowerCase() } }),
      ]);

type VoteWithProposal = Vote & { proposal: { description: string; status: string } };

      return reply.send({
        data: votes.map((v: VoteWithProposal) => ({ ...serializeVote(v), proposal: v.proposal })),
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      });
    }
  );
};

type ProposalWithCount = {
  id: string;
  proposalId: string;
  chainId: number;
  proposer: string;
  description: string;
  startBlock: bigint;
  endBlock: bigint;
  status: string;
  txHash: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { votes: number };
};

function serializeProposal(p: ProposalWithCount) {
  return {
    ...p,
    startBlock: p.startBlock.toString(),
    endBlock: p.endBlock.toString(),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

type Vote = {
  id: string;
  proposalId: string;
  voter: string;
  support: number;
  weight: string;
  reason: string | null;
  txHash: string;
  blockNumber: bigint;
  createdAt: Date;
};

function serializeVote(v: Vote) {
  return {
    ...v,
    blockNumber: v.blockNumber.toString(),
    createdAt: v.createdAt.toISOString(),
  };
}

export default governanceRoute;
