import { requireOwner } from "../lib/convex-auth";
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const getCommissions = query({
  args: {
    userId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("commissions"),
      _creationTime: v.number(),
      referrerUserId: v.string(),
      referralId: v.id("referrals"),
      amount: v.number(),
      status: v.union(v.literal("pending"), v.literal("paid"), v.literal("cancelled")),
      paidAt: v.optional(v.number()),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    return await ctx.db
      .query("commissions")
      .withIndex("by_referrerUserId", (q) => q.eq("referrerUserId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getCommissionStats = query({
  args: {
    userId: v.string(),
  },
  returns: v.object({
    totalEarned: v.number(),
    pending: v.number(),
    paid: v.number(),
    count: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const commissions = await ctx.db
      .query("commissions")
      .withIndex("by_referrerUserId", (q) => q.eq("referrerUserId", args.userId))
      .collect();

    const stats = {
      totalEarned: 0,
      pending: 0,
      paid: 0,
      count: commissions.length,
    };

    for (const commission of commissions) {
      if (commission.status === "paid") {
        stats.totalEarned += commission.amount;
        stats.paid += commission.amount;
      } else if (commission.status === "pending") {
        stats.pending += commission.amount;
      }
    }

    return stats;
  },
});

export const createCommission = internalMutation({
  args: {
    referrerUserId: v.string(),
    referralId: v.id("referrals"),
    amount: v.number(),
  },
  returns: v.id("commissions"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("commissions", {
      referrerUserId: args.referrerUserId,
      referralId: args.referralId,
      amount: args.amount,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const updateCommissionStatus = internalMutation({
  args: {
    commissionId: v.id("commissions"),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("cancelled")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updateData: {
      status: "pending" | "paid" | "cancelled";
      paidAt?: number;
    } = {
      status: args.status,
    };

    if (args.status === "paid") {
      updateData.paidAt = Date.now();
    }

    await ctx.db.patch(args.commissionId, updateData);
    return null;
  },
});
