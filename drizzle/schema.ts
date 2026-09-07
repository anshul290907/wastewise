import { boolean, double, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Google subject identifier. Stable and never accepted from the browser. */
  openId: varchar("openId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  profileImageUrl: text("profileImageUrl"),
  role: mysqlEnum("role", ["student", "admin"]).default("student").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const instituteSettings = mysqlTable("institute_settings", {
  id: int("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull().default("NSUT"),
  slug: varchar("slug", { length: 160 }).notNull().default("nsut"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** One aggregate row per account. Points are intentionally separate fields so the scoring model is easy to change. */
export const leaderboardEntries = mysqlTable("leaderboard_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").unique(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  profileImageUrl: text("profileImageUrl"),
  reportsSubmitted: int("reportsSubmitted").notNull().default(0),
  verifiedContributions: int("verifiedContributions").notNull().default(0),
  cleanupContributions: int("cleanupContributions").notNull().default(0),
  otherPoints: int("otherPoints").notNull().default(0),
  totalPoints: int("totalPoints").notNull().default(0),
  isDemo: boolean("isDemo").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const contributionRules = mysqlTable("contribution_rules", {
  id: int("id").autoincrement().primaryKey(),
  actionType: varchar("actionType", { length: 80 }).notNull().unique(),
  points: int("points").notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Campus map metadata is keyed by the institute slug, not by a frontend toggle.
 * locationsJson contains reviewed/illustrative marker metadata and is intentionally
 * replaceable when an institute supplies verified GIS data.
 */
export const campusMapConfigs = mysqlTable("campus_map_configs", {
  id: int("id").autoincrement().primaryKey(),
  instituteSlug: varchar("instituteSlug", { length: 160 }).notNull().unique(),
  centerLat: double("centerLat").notNull(),
  centerLng: double("centerLng").notNull(),
  zoom: int("zoom").notNull().default(16),
  locationsJson: text("locationsJson").notNull(),
  sourceUrl: text("sourceUrl"),
  isVerified: boolean("isVerified").notNull().default(false),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const wasteReports = mysqlTable("waste_reports", {
  id: varchar("id", { length: 40 }).primaryKey(),
  userId: int("userId").notNull(),
  reporterName: varchar("reporterName", { length: 255 }).notNull(),
  issue: varchar("issue", { length: 160 }).notNull(),
  location: varchar("location", { length: 160 }).notNull(),
  priority: mysqlEnum("priority", ["Normal", "Important", "Urgent"]).notNull(),
  description: text("description"),
  photoName: varchar("photoName", { length: 255 }),
  status: mysqlEnum("status", ["Reported", "Assigned", "In Progress", "Resolved"]).notNull().default("Reported"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type InstituteSettings = typeof instituteSettings.$inferSelect;
export type LeaderboardEntry = typeof leaderboardEntries.$inferSelect;
export type CampusMapConfig = typeof campusMapConfigs.$inferSelect;
export type WasteReport = typeof wasteReports.$inferSelect;
