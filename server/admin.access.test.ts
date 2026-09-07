import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

function user(role: User["role"]): User {
  const now = new Date();
  return {
    id: 1,
    openId: "google-subject",
    name: "WasteWise Tester",
    email: "tester@example.com",
    profileImageUrl: null,
    role,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

function context(currentUser: User): TrpcContext {
  return {
    user: currentUser,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin.access", () => {
  it("rejects a student even when the client requests the admin procedure", async () => {
    const caller = appRouter.createCaller(context(user("student")));
    await expect(caller.admin.access()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("permits an authenticated database admin", async () => {
    const caller = appRouter.createCaller(context(user("admin")));
    await expect(caller.admin.access()).resolves.toEqual({ ok: true, userId: 1, role: "admin" });
  });
});
