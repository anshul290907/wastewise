import crypto from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { upsertGoogleUser } from "../db";
import { ENV } from "../_core/env";
import { createSessionToken, setSessionCookie } from "./session";

const GOOGLE_STATE_COOKIE = "ww_google_oauth_state";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function callbackUrl(req: Request) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const forwardedHost = req.headers["x-forwarded-host"];
  const protocol = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto?.split(",")[0]?.trim()) || req.protocol;
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost?.split(",")[0]?.trim()) || req.get("host");
  return ENV.googleCallbackUrl || `${protocol}://${host}/api/auth/google/callback`;
}

function secureCookie(req: Request) {
  return req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" || ENV.isProduction;
}

function isConfigured() {
  return Boolean(ENV.googleClientId && ENV.googleClientSecret);
}

function stateCookieOptions(req: Request) {
  return {
    httpOnly: true,
    secure: secureCookie(req),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60 * 1000,
  };
}

function getQueryParam(req: Request, key: string) {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

async function exchangeCode(code: string, redirectUri: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const payload = (await response.json()) as { id_token?: string; error?: string; error_description?: string };
  if (!response.ok || !payload.id_token) {
    throw new Error(payload.error_description || payload.error || "Google token exchange failed");
  }
  return payload.id_token;
}

export function registerGoogleOAuthRoutes(app: Express) {
  app.get("/api/auth/google/config", (_req, res) => {
    res.json({ configured: isConfigured() });
  });

  app.get("/api/auth/google/start", (req: Request, res: Response) => {
    if (!isConfigured()) {
      res.status(503).json({ error: "Google OAuth is not configured on the server" });
      return;
    }

    const state = crypto.randomBytes(32).toString("hex");
    res.cookie(GOOGLE_STATE_COOKIE, state, stateCookieOptions(req));

    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", ENV.googleClientId);
    url.searchParams.set("redirect_uri", callbackUrl(req));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    res.redirect(302, url.toString());
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    if (!isConfigured()) {
      res.status(503).json({ error: "Google OAuth is not configured on the server" });
      return;
    }

    const error = getQueryParam(req, "error");
    if (error) {
      res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
      return;
    }

    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const expectedState = parseCookieHeader(req.headers.cookie ?? "")[GOOGLE_STATE_COOKIE];
    res.clearCookie(GOOGLE_STATE_COOKIE, stateCookieOptions(req));

    const statesMatch = Boolean(
      state &&
        expectedState &&
        state.length === expectedState.length &&
        crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState)),
    );
    if (!code || !statesMatch) {
      res.status(403).json({ error: "Invalid Google OAuth state" });
      return;
    }

    try {
      const idToken = await exchangeCode(code, callbackUrl(req));
      const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: ENV.googleClientId,
      });

      const subject = typeof payload.sub === "string" ? payload.sub : "";
      const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
      const emailVerified = payload.email_verified === true || payload.email_verified === "true";
      const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email;
      const profileImageUrl = typeof payload.picture === "string" ? payload.picture : null;

      if (!subject || !email || !emailVerified) {
        res.status(403).json({ error: "Google account email is missing or not verified" });
        return;
      }

      const user = await upsertGoogleUser({
        openId: subject,
        name,
        email,
        profileImageUrl,
      });
      const sessionToken = await createSessionToken(user);
      setSessionCookie(req, res, sessionToken);
      res.redirect(302, "/app");
    } catch (callbackError) {
      console.error("[Google OAuth] callback failed", callbackError);
      res.redirect("/?auth_error=google_callback_failed");
    }
  });
}
