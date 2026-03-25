import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { randomBytes } from "crypto";
import { authenticate } from "../middleware/auth.js";

const registerWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().min(16).optional(),
});

const webhooksRoute: FastifyPluginAsync = async (fastify) => {
  // POST /webhooks — register endpoint
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Register a webhook endpoint",
        body: {
          type: "object",
          required: ["url", "events"],
          properties: {
            url: { type: "string", format: "uri" },
            events: { type: "array", items: { type: "string" }, minItems: 1 },
            secret: { type: "string", minLength: 16 },
          },
        },
      },
    },
    async (request, reply) => {
      const body = registerWebhookSchema.parse(request.body);
      const secret = body.secret ?? randomBytes(32).toString("hex");

      const webhook = await fastify.prisma.webhookEndpoint.create({
        data: {
          url: body.url,
          secret,
          events: body.events,
          isActive: true,
        },
      });

      return reply.code(201).send({ data: { ...webhook, secret } });
    }
  );

  // GET /webhooks — list (admin only)
  fastify.get(
    "/",
    {
      schema: { tags: ["Webhooks"], summary: "List all webhooks (admin)" },
      preHandler: authenticate,
    },
    async (_request, reply) => {
      const webhooks = await fastify.prisma.webhookEndpoint.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          url: true,
          events: true,
          isActive: true,
          createdAt: true,
          _count: { select: { deliveries: true } },
        },
      });

      return reply.send({ data: webhooks });
    }
  );

  // DELETE /webhooks/:id
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Delete a webhook endpoint",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id } = request.params;

      const existing = await fastify.prisma.webhookEndpoint.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: "Webhook not found" });
      }

      await fastify.prisma.webhookEndpoint.delete({ where: { id } });
      return reply.code(204).send();
    }
  );

  // GET /webhooks/:id/deliveries
  fastify.get<{ Params: { id: string } }>(
    "/:id/deliveries",
    {
      schema: {
        tags: ["Webhooks"],
        summary: "Get delivery history for a webhook",
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
      preHandler: authenticate,
    },
    async (request, reply) => {
      const { id } = request.params;
      const query = z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          limit: z.coerce.number().int().min(1).max(100).default(20),
        })
        .parse(request.query);
      const skip = (query.page - 1) * query.limit;

      const existing = await fastify.prisma.webhookEndpoint.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: "Webhook not found" });
      }

      const [deliveries, total] = await Promise.all([
        fastify.prisma.webhookDelivery.findMany({
          where: { webhookId: id },
          skip,
          take: query.limit,
          orderBy: { createdAt: "desc" },
        }),
        fastify.prisma.webhookDelivery.count({ where: { webhookId: id } }),
      ]);

      return reply.send({
        data: deliveries.map((d: typeof deliveries[number]) => ({
          ...d,
          createdAt: d.createdAt.toISOString(),
          lastAttemptAt: d.lastAttemptAt?.toISOString() ?? null,
        })),
        pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
      });
    }
  );
};

export default webhooksRoute;
