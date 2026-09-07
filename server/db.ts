import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { CampusMapConfig, InsertUser, InstituteSettings, LeaderboardEntry, User, WasteReport, campusMapConfigs, contributionRules, instituteSettings, leaderboardEntries, users, wasteReports } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export type CampusMapLocation = {
  id: string;
  name: string;
  type: "campus" | "landmark" | "bin" | "collection" | "hotspot";
  detail: string;
  lat: number;
  lng: number;
  verified: boolean;
};

export type CampusMapData = {
  instituteSlug: string;
  center: { lat: number; lng: number };
  zoom: number;
  locations: CampusMapLocation[];
  sourceUrl: string | null;
  isVerified: boolean;
};

const nsutMapLocations: CampusMapLocation[] = [
  { id: "nsut-campus-area", name: "NSUT main campus area", type: "campus", detail: "Approximate campus reference area based on the official NSUT location page. Verify official boundaries before operational use.", lat: 28.6097, lng: 77.0380, verified: false },
  { id: "nsut-main-gate", name: "NSUT Main Gate · illustrative", type: "landmark", detail: "Illustrative planning marker near the official Sector 3, Dwarka campus address; replace with verified GIS coordinates.", lat: 28.6110, lng: 77.0370, verified: false },
  { id: "nsut-collection-a", name: "Collection point A · illustrative", type: "collection", detail: "Waste collection planning marker; not an official NSUT facilities record.", lat: 28.6088, lng: 77.0392, verified: false },
  { id: "nsut-hotspot-a", name: "Reported waste hotspot · illustrative", type: "hotspot", detail: "Illustrative reported-waste marker for the interaction flow.", lat: 28.6103, lng: 77.0400, verified: false },
  { id: "nsut-bin-a", name: "Dry-waste bin · illustrative", type: "bin", detail: "Illustrative bin marker for the map interaction flow.", lat: 28.6079, lng: 77.0376, verified: false },
];

const defaultRules = [
  { actionType: "report_submitted", points: 10, label: "Waste report submitted" },
  { actionType: "report_verified", points: 25, label: "Verified waste report" },
  { actionType: "cleanup_contribution", points: 50, label: "Cleanup contribution" },
  { actionType: "other", points: 5, label: "Other sustainability action" },
];

const demoLeaderboard = [
  { displayName: "Aarav Kapoor", reportsSubmitted: 24, verifiedContributions: 18, cleanupContributions: 7, otherPoints: 15, totalPoints: 1245 },
  { displayName: "Meera Iyer", reportsSubmitted: 20, verifiedContributions: 15, cleanupContributions: 6, otherPoints: 10, totalPoints: 1035 },
  { displayName: "Devansh Patel", reportsSubmitted: 17, verifiedContributions: 12, cleanupContributions: 5, otherPoints: 20, totalPoints: 895 },
];

export async function getDb() {
  if (!_db && ENV.databaseUrl) _db = drizzle(ENV.databaseUrl);
  return _db;
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

/** Compatibility helper for generated framework code that is no longer on the request path. */
export async function upsertUser(input: { openId: string; name?: string | null; email?: string | null; loginMethod?: string | null; lastSignedIn?: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const existing = await getUserByOpenId(input.openId);
  if (existing) {
    await db.update(users).set({ name: input.name || existing.name, lastSignedIn: input.lastSignedIn ?? new Date() }).where(eq(users.id, existing.id));
    return;
  }
  await db.insert(users).values({ openId: input.openId, name: input.name || "System User", email: (input.email || `${input.openId}@system.invalid`).toLowerCase(), role: "student", lastSignedIn: input.lastSignedIn ?? new Date() });
}

export async function upsertGoogleUser(input: { openId: string; name: string; email: string; profileImageUrl?: string | null }): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const email = input.email.trim().toLowerCase();
  const existingByOpenId = await getUserByOpenId(input.openId);
  const existingByEmail = await getUserByEmail(email);
  if (existingByEmail && existingByEmail.openId !== input.openId) throw new Error("A different Google account is already registered with this email");
  const isConfiguredAdmin = ENV.adminEmails.includes(email);
  if (existingByOpenId) {
    const role = existingByOpenId.role === "admin" || isConfiguredAdmin ? "admin" : "student";
    await db.update(users).set({ name: input.name, email, profileImageUrl: input.profileImageUrl ?? null, role, lastSignedIn: new Date() }).where(and(eq(users.id, existingByOpenId.id), eq(users.openId, input.openId)));
    const updated = await getUserById(existingByOpenId.id);
    if (!updated) throw new Error("User disappeared after update");
    return updated;
  }
  const result = await db.insert(users).values({ openId: input.openId, name: input.name, email, profileImageUrl: input.profileImageUrl ?? null, role: isConfiguredAdmin ? "admin" : "student", lastSignedIn: new Date() });
  const created = await getUserById(Number(result[0].insertId));
  if (!created) throw new Error("User was created but could not be loaded");
  return created;
}

export async function ensureCampusDefaults() {
  const db = await getDb();
  if (!db) return;
  await db.insert(instituteSettings).values({ id: 1, name: "NSUT", slug: "nsut" }).onDuplicateKeyUpdate({ set: { id: 1 } });
  for (const rule of defaultRules) await db.insert(contributionRules).values(rule).onDuplicateKeyUpdate({ set: { points: rule.points, label: rule.label } });
  await db.insert(campusMapConfigs).values({ instituteSlug: "nsut", centerLat: 28.6097, centerLng: 77.0380, zoom: 16, locationsJson: JSON.stringify(nsutMapLocations), sourceUrl: "https://www.nsut.ac.in/en/location", isVerified: false }).onDuplicateKeyUpdate({ set: { instituteSlug: "nsut" } });
  const existing = await db.select({ id: leaderboardEntries.id }).from(leaderboardEntries).where(eq(leaderboardEntries.isDemo, true)).limit(1);
  if (!existing[0]) {
    for (const entry of demoLeaderboard) await db.insert(leaderboardEntries).values({ ...entry, isDemo: true });
  }
}

export async function getInstituteSettings(): Promise<InstituteSettings> {
  const db = await getDb();
  if (!db) return { id: 1, name: "NSUT", slug: "nsut", updatedAt: new Date() };
  await ensureCampusDefaults();
  const row = await db.select().from(instituteSettings).where(eq(instituteSettings.id, 1)).limit(1);
  return row[0] ?? { id: 1, name: "NSUT", slug: "nsut", updatedAt: new Date() };
}

export async function updateInstituteSettings(name: string): Promise<InstituteSettings> {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.length < 2 || cleanName.length > 160) throw new Error("Institute name must be between 2 and 160 characters");
  const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 160) || "campus";
  await db.insert(instituteSettings).values({ id: 1, name: cleanName, slug }).onDuplicateKeyUpdate({ set: { name: cleanName, slug } });
  const row = await db.select().from(instituteSettings).where(eq(instituteSettings.id, 1)).limit(1);
  if (!row[0]) throw new Error("Institute settings could not be saved");
  return row[0];
}

export async function getCampusMapConfig(instituteSlug: string): Promise<CampusMapData | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureCampusDefaults();
  const row = await db.select().from(campusMapConfigs).where(eq(campusMapConfigs.instituteSlug, instituteSlug)).limit(1);
  const config = row[0];
  if (!config) return null;
  let locations: CampusMapLocation[] = [];
  try {
    const parsed: unknown = JSON.parse(config.locationsJson);
    if (Array.isArray(parsed)) locations = parsed as CampusMapLocation[];
  } catch {
    locations = [];
  }
  return { instituteSlug: config.instituteSlug, center: { lat: config.centerLat, lng: config.centerLng }, zoom: config.zoom, locations, sourceUrl: config.sourceUrl, isVerified: config.isVerified };
}

export async function upsertCampusMapConfig(input: { instituteSlug: string; centerLat: number; centerLng: number; zoom: number; locations: CampusMapLocation[]; sourceUrl?: string | null; isVerified?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const slug = input.instituteSlug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Institute map slug must be lowercase kebab-case");
  if (input.locations.length > 200) throw new Error("A map configuration cannot contain more than 200 locations");
  await db.insert(campusMapConfigs).values({ instituteSlug: slug, centerLat: input.centerLat, centerLng: input.centerLng, zoom: input.zoom, locationsJson: JSON.stringify(input.locations), sourceUrl: input.sourceUrl ?? null, isVerified: input.isVerified ?? false }).onDuplicateKeyUpdate({ set: { centerLat: input.centerLat, centerLng: input.centerLng, zoom: input.zoom, locationsJson: JSON.stringify(input.locations), sourceUrl: input.sourceUrl ?? null, isVerified: input.isVerified ?? false } });
  return getCampusMapConfig(slug);
}

export async function getLeaderboard() {
  const db = await getDb();
  if (!db) return [] as LeaderboardEntry[];
  await ensureCampusDefaults();
  return db.select().from(leaderboardEntries).orderBy(desc(leaderboardEntries.totalPoints), asc(leaderboardEntries.displayName));
}

export async function getLeaderboardForUser(user: User) {
  const db = await getDb();
  if (!db) return undefined;
  const row = await db.select().from(leaderboardEntries).where(eq(leaderboardEntries.userId, user.id)).limit(1);
  return row[0];
}

export async function recordContribution(user: User, actionType: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await ensureCampusDefaults();
  const rule = (await db.select().from(contributionRules).where(eq(contributionRules.actionType, actionType)).limit(1))[0];
  if (!rule) throw new Error("Unknown contribution type");
  const current = await getLeaderboardForUser(user);
  const updates = actionType === "report_submitted" ? { reportsSubmitted: sql`${leaderboardEntries.reportsSubmitted} + 1` } : actionType === "report_verified" ? { verifiedContributions: sql`${leaderboardEntries.verifiedContributions} + 1` } : actionType === "cleanup_contribution" ? { cleanupContributions: sql`${leaderboardEntries.cleanupContributions} + 1` } : { otherPoints: sql`${leaderboardEntries.otherPoints} + ${rule.points}` };
  if (current) {
    await db.update(leaderboardEntries).set({ ...updates, totalPoints: sql`${leaderboardEntries.totalPoints} + ${rule.points}`, displayName: user.name, profileImageUrl: user.profileImageUrl }).where(eq(leaderboardEntries.userId, user.id));
  } else {
    await db.insert(leaderboardEntries).values({ userId: user.id, displayName: user.name, profileImageUrl: user.profileImageUrl, reportsSubmitted: actionType === "report_submitted" ? 1 : 0, verifiedContributions: actionType === "report_verified" ? 1 : 0, cleanupContributions: actionType === "cleanup_contribution" ? 1 : 0, otherPoints: actionType === "other" ? rule.points : 0, totalPoints: rule.points, isDemo: false });
  }
}

export async function createWasteReport(input: { id: string; user: User; issue: string; location: string; priority: WasteReport["priority"]; description?: string; photoName?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.insert(wasteReports).values({ id: input.id, userId: input.user.id, reporterName: input.user.name, issue: input.issue, location: input.location, priority: input.priority, description: input.description || null, photoName: input.photoName ?? null, status: "Reported" });
  await recordContribution(input.user, "report_submitted");
  const row = await db.select().from(wasteReports).where(eq(wasteReports.id, input.id)).limit(1);
  if (!row[0]) throw new Error("Report was created but could not be loaded");
  return row[0];
}

export async function getWasteReports(user: User) {
  const db = await getDb();
  if (!db) return [] as WasteReport[];
  return user.role === "admin"
    ? db.select().from(wasteReports).orderBy(desc(wasteReports.createdAt))
    : db.select().from(wasteReports).where(eq(wasteReports.userId, user.id)).orderBy(desc(wasteReports.createdAt));
}

export async function advanceWasteReport(id: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const current = (await db.select().from(wasteReports).where(eq(wasteReports.id, id)).limit(1))[0];
  if (!current) throw new Error("Report not found");
  const nextStatus: WasteReport["status"] = current.status === "Reported" ? "Assigned" : current.status === "Assigned" ? "In Progress" : "Resolved";
  await db.update(wasteReports).set({ status: nextStatus }).where(eq(wasteReports.id, id));
  if (nextStatus === "Resolved" && current.status !== "Resolved") {
    const owner = await getUserById(current.userId);
    if (owner) await recordContribution(owner, "report_verified");
  }
  const updated = (await db.select().from(wasteReports).where(eq(wasteReports.id, id)).limit(1))[0];
  if (!updated) throw new Error("Report update could not be loaded");
  return updated;
}
