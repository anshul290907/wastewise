import express from "express";
import { describe, expect, it } from "vitest";
import { registerGoogleOAuthRoutes } from "./auth/google";

describe("Google OAuth configuration endpoint", () => {
  async function startTestServer() {
    const app = express();
    registerGoogleOAuthRoutes(app);
    const server = await new Promise<ReturnType<typeof app.listen>>(resolve => {
      const instance = app.listen(0, () => resolve(instance));
    });
    return server;
  }

  it("reports Google OAuth as configured when the server secrets are present", async () => {
    const server = await startTestServer();

    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Test server did not expose a port");
      const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/google/config`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ configured: true });
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  it("uses the securely configured production callback URI", async () => {
    const server = await startTestServer();
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Test server did not expose a port");
      const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/google/start`, {
        redirect: "manual",
        headers: {
          "x-forwarded-proto": "https",
          "x-forwarded-host": "old-preview.example",
        },
      });
      expect(response.status).toBe(302);
      const location = response.headers.get("location");
      expect(location).toBeTruthy();
      expect(new URL(location!).searchParams.get("redirect_uri")).toBe(
        "https://wastewise-kpxdf8u8.manus.space/api/auth/google/callback",
      );
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
