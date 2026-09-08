import { requireOwner } from "../lib/convex-auth";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getReferralsSent = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    return await ctx.db
      .query("referrals")
      .withIndex("by_referrerUserId", (q) => q.eq("referrerUserId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getReferralsReceived = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    return await ctx.db
      .query("referrals")
      .withIndex("by_referredUserId", (q) => q.eq("referredUserId", args.userId))
      .order("desc")
      .collect();
  },
});

export const createReferral = mutation({
  args: {
    referrerUserId: v.string(),
    referredUserId: v.string(),
    referredFirstName: v.string(),
    referredEmail: v.string(),
    referredPhone: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.referrerUserId);
    return await ctx.db.insert("referrals", {
      referrerUserId: args.referrerUserId,
      referredUserId: args.referredUserId,
      referredFirstName: args.referredFirstName,
      referredEmail: args.referredEmail,
      referredPhone: args.referredPhone,
      message: args.message,
      createdAt: Date.now(),
    });
  },
});
