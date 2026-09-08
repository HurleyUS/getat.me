import { requireOwner } from "../lib/convex-auth";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getPaymentSettings = query({
  args: {
    userId: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      _id: v.id("paymentSettings"),
      _creationTime: v.number(),
      userId: v.string(),
      enabled: v.boolean(),
      currency: v.string(),
      defaultPrice: v.number(),
      stripeAccountId: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    let userId = args.userId;

    // Try to get from auth if userId not provided
    if (!userId) {
      const user = await ctx.auth.getUserIdentity();
      if (user) {
        userId = user.subject;
      }
    }

    if (!userId) {
      return null;
    }

    try {
      return await ctx.db
        .query("paymentSettings")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
    } catch (error) {
      console.error("Error fetching payment settings:", error);
      return null;
    }
  },
});

export const updatePaymentSettings = mutation({
  args: {
    userId: v.string(),
    enabled: v.optional(v.boolean()),
    currency: v.optional(v.string()),
    defaultPrice: v.optional(v.number()),
    stripeAccountId: v.optional(v.string()),
  },
  returns: v.id("paymentSettings"),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const existing = await ctx.db
      .query("paymentSettings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    const now = Date.now();
    const updateData: {
      enabled?: boolean;
      currency?: string;
      defaultPrice?: number;
      stripeAccountId?: string;
      updatedAt: number;
    } = {
      updatedAt: now,
    };

    if (args.enabled !== undefined) updateData.enabled = args.enabled;
    if (args.currency !== undefined) updateData.currency = args.currency;
    if (args.defaultPrice !== undefined) updateData.defaultPrice = args.defaultPrice;
    if (args.stripeAccountId !== undefined) updateData.stripeAccountId = args.stripeAccountId;

    if (existing) {
      await ctx.db.patch(existing._id, updateData);
      return existing._id;
    } else {
      return await ctx.db.insert("paymentSettings", {
        userId: args.userId,
        enabled: args.enabled ?? false,
        currency: args.currency ?? "USD",
        defaultPrice: args.defaultPrice ?? 0,
        stripeAccountId: args.stripeAccountId,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
