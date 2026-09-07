import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import { getUserById } from "../db";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "../../shared/const";
import { ENV } from "../_core/env";

const SESSION_TTL = "30d";

function sessionSecret() {
  if (!ENV.cookieSecret) throw new Error("JWT_SECRET is required for secure sessions");
  return new TextEncoder().encode(ENV.cookieSecret);
}

function sessionCookieOptions(req: Request) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const isHttps = req.protocol === "https" || forwardedProto === "https" || ENV.isProduction;
  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function createSessionToken(user: User) {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(sessionSecret());
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    ...sessionCookieOptions(req),
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, sessionCookieOptions(req));
}

export async function authenticateSession(req: Request): Promise<User | null> {
  const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionSecret(), {
      algorithms: ["HS256"],
    });
    const id = Number(payload.sub);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return (await getUserById(id)) ?? null;
  } catch {
    return null;
  }
}
