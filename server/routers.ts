import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { clearSessionCookie } from "./auth/session";
import { ENV } from "./_core/env";
import { advanceWasteReport, createWasteReport, getCampusMapConfig, getInstituteSettings, getLeaderboard, getWasteReports, recordContribution, updateInstituteSettings, upsertCampusMapConfig } from "./db";
import { z } from "zod";

const mapLocationSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(180),
  type: z.enum(["campus", "landmark", "bin", "collection", "hotspot"]),
  detail: z.string().min(1).max(500),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  verified: z.boolean(),
});

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    googleConfig: publicProcedure.query(() => ({ configured: Boolean(ENV.googleClientId && ENV.googleClientSecret) })),
    logout: protectedProcedure.mutation(({ ctx }) => { clearSessionCookie(ctx.req, ctx.res); return { success: true } as const; }),
  }),
  account: router({ me: protectedProcedure.query(({ ctx }) => ctx.user) }),
  institute: router({
    config: publicProcedure.query(() => getInstituteSettings()),
    update: adminProcedure.input(z.object({ name: z.string().min(2).max(160) })).mutation(({ input }) => updateInstituteSettings(input.name)),
  }),
  campusMap: router({
    config: protectedProcedure.input(z.object({ instituteSlug: z.string().min(1).max(160) })).query(({ input }) => getCampusMapConfig(input.instituteSlug)),
    upsert: adminProcedure.input(z.object({ instituteSlug: z.string().min(1).max(160), centerLat: z.number().min(-90).max(90), centerLng: z.number().min(-180).max(180), zoom: z.number().int().min(1).max(22), locations: z.array(mapLocationSchema).max(200), sourceUrl: z.string().url().nullable().optional(), isVerified: z.boolean().optional() })).mutation(({ input }) => upsertCampusMapConfig(input)),
  }),
  leaderboard: router({
    list: protectedProcedure.query(({ ctx }) => getLeaderboard().then(entries => entries.map((entry, index) => ({ ...entry, rank: index + 1, isCurrentUser: entry.userId === ctx.user.id })))),
    record: protectedProcedure.input(z.object({ actionType: z.enum(["report_submitted", "report_verified", "cleanup_contribution", "other"]) })).mutation(({ ctx, input }) => recordContribution(ctx.user, input.actionType).then(() => ({ success: true } as const))),
  }),
  reports: router({
    list: protectedProcedure.query(({ ctx }) => getWasteReports(ctx.user)),
    create: protectedProcedure.input(z.object({ id: z.string().min(8).max(40), issue: z.string().min(1).max(160), location: z.string().min(1).max(160), priority: z.enum(["Normal", "Important", "Urgent"]), description: z.string().max(500).optional(), photoName: z.string().max(255).nullable().optional() })).mutation(({ ctx, input }) => createWasteReport({ ...input, user: ctx.user })),
    advance: adminProcedure.input(z.object({ id: z.string().min(8).max(40) })).mutation(({ input }) => advanceWasteReport(input.id)),
  }),
  admin: router({
    access: adminProcedure.query(({ ctx }) => ({ ok: true as const, userId: ctx.user.id, role: ctx.user.role })),
  }),
});

export type AppRouter = typeof appRouter;
