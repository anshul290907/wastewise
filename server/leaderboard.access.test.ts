import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

vi.mock("./db", () => ({
  getInstituteSettings: vi.fn().mockResolvedValue({ id: 1, name: "NSUT", slug: "nsut", updatedAt: new Date() }),
  updateInstituteSettings: vi.fn().mockResolvedValue({ id: 1, name: "IIT Delhi", slug: "iit-delhi", updatedAt: new Date() }),
  getCampusMapConfig: vi.fn().mockResolvedValue({ instituteSlug: "nsut", center: { lat: 28.6097, lng: 77.038 }, zoom: 16, locations: [], sourceUrl: "https://www.nsut.ac.in/en/location", isVerified: false }),
  upsertCampusMapConfig: vi.fn().mockResolvedValue({ instituteSlug: "iit-delhi", center: { lat: 28.6, lng: 77.2 }, zoom: 15, locations: [], sourceUrl: null, isVerified: false }),
  getLeaderboard: vi.fn().mockResolvedValue([
    { id: 1, userId: 10, displayName: "Aarav Kapoor", profileImageUrl: null, reportsSubmitted: 4, verifiedContributions: 2, cleanupContributions: 1, otherPoints: 0, totalPoints: 160, isDemo: true, createdAt: new Date(), updatedAt: new Date() },
    { id: 2, userId: 11, displayName: "Meera Iyer", profileImageUrl: null, reportsSubmitted: 3, verifiedContributions: 1, cleanupContributions: 0, otherPoints: 0, totalPoints: 95, isDemo: false, createdAt: new Date(), updatedAt: new Date() },
  ]),
  recordContribution: vi.fn().mockResolvedValue(undefined),
}));

function user(role: User["role"]): User {
  const now = new Date();
  return { id: 11, openId: "google-subject", name: "Meera Iyer", email: "meera@example.com", profileImageUrl: null, role, createdAt: now, updatedAt: now, lastSignedIn: now };
}

function context(currentUser?: User): TrpcContext {
  return { user: currentUser, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("leaderboard and institute authorization", () => {
  it("rejects an unauthenticated leaderboard request", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.leaderboard.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns server-ranked rows and highlights the authenticated user", async () => {
    const caller = appRouter.createCaller(context(user("student")));
    await expect(caller.leaderboard.list()).resolves.toMatchObject([
      { rank: 1, displayName: "Aarav Kapoor", isCurrentUser: false },
      { rank: 2, displayName: "Meera Iyer", isCurrentUser: true },
    ]);
  });

  it("rejects institute changes from a student", async () => {
    const caller = appRouter.createCaller(context(user("student")));
    await expect(caller.institute.update({ name: "IIT Delhi" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an admin to change the institute name", async () => {
    const caller = appRouter.createCaller(context(user("admin")));
    await expect(caller.institute.update({ name: "IIT Delhi" })).resolves.toMatchObject({ name: "IIT Delhi", slug: "iit-delhi" });
  });

  it("loads map data only for an authenticated account", async () => {
    const caller = appRouter.createCaller(context(user("student")));
    await expect(caller.campusMap.config({ instituteSlug: "nsut" })).resolves.toMatchObject({ instituteSlug: "nsut", zoom: 16 });
  });

  it("rejects map configuration writes from a student", async () => {
    const caller = appRouter.createCaller(context(user("student")));
    await expect(caller.campusMap.upsert({ instituteSlug: "iit-delhi", centerLat: 28.6, centerLng: 77.2, zoom: 15, locations: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an admin to configure another institute map", async () => {
    const caller = appRouter.createCaller(context(user("admin")));
    await expect(caller.campusMap.upsert({ instituteSlug: "iit-delhi", centerLat: 28.6, centerLng: 77.2, zoom: 15, locations: [] })).resolves.toMatchObject({ instituteSlug: "iit-delhi" });
  });
});
