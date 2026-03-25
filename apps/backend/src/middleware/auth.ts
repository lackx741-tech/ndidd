import type { FastifyRequest, FastifyReply } from "fastify";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: "Unauthorized", message: "Invalid or missing token" });
  }
}

export interface JwtPayload {
  sub: string;
  role: "admin" | "user" | "api";
  apiKey?: string;
  iat: number;
  exp: number;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
