import type { FastifyPluginAsync } from "fastify";

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Health check",
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              version: { type: "string" },
              uptime: { type: "number" },
              timestamp: { type: "string" },
              database: { type: "string" },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      let dbStatus = "ok";

      try {
        await fastify.prisma.$queryRaw`SELECT 1`;
      } catch {
        dbStatus = "error";
      }

      return reply.send({
        status: "ok",
        version: process.env["npm_package_version"] ?? "0.1.0",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: dbStatus,
      });
    }
  );
};

export default healthRoute;
