import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

// Minimal env stubs required by config validation
process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test";
process.env["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters-long";
process.env["REDIS_URL"] = "redis://localhost:6379";
process.env["NODE_ENV"] = "test";

// Dynamically import after env is set
const { buildApp } = await import("../index.js");

describe("GET /api/v1/health", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp() as FastifyInstance;
    (app as FastifyInstance & { prisma: unknown }).prisma = {
      $queryRaw: async () => [{ "?column?": 1 }],
      $disconnect: async () => undefined,
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 with status ok", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ status: string; uptime: number; timestamp: string }>();
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
  });

  it("returns 404 for unknown routes", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/does-not-exist" });
    expect(response.statusCode).toBe(404);
  });
});
