import { requireOwner } from "../lib/convex-auth";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getVerification = query({
  args: {
    userId: v.string(),
    type: v.union(v.literal("verified"), v.literal("vetted")),
  },
  returns: v.union(
    v.object({
      _id: v.id("verifications"),
      _creationTime: v.number(),
      userId: v.string(),
      type: v.union(v.literal("verified"), v.literal("vetted")),
      status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
      applicationData: v.optional(
        v.object({
          documentUrl: v.optional(v.id("_storage")),
          additionalInfo: v.optional(v.string()),
        }),
      ),
      reviewedAt: v.optional(v.number()),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const verification = await ctx.db
      .query("verifications")
      .withIndex("by_userId_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
      .first();
    if (!verification) return null;
    const identity = await ctx.auth.getUserIdentity();
    return {
      ...verification,
      applicationData: identity?.subject === args.userId ? verification.applicationData : undefined,
    };
  },
});

export const getVerificationStatus = query({
  args: {
    userId: v.string(),
  },
  returns: v.object({
    verified: v.union(
      v.object({
        status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
        createdAt: v.number(),
      }),
      v.null(),
    ),
    vetted: v.union(
      v.object({
        status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
        createdAt: v.number(),
      }),
      v.null(),
    ),
  }),
  handler: async (ctx, args) => {
    const verified = await ctx.db
      .query("verifications")
      .withIndex("by_userId_type", (q) => q.eq("userId", args.userId).eq("type", "verified"))
      .first();

    const vetted = await ctx.db
      .query("verifications")
      .withIndex("by_userId_type", (q) => q.eq("userId", args.userId).eq("type", "vetted"))
      .first();

    return {
      verified: verified
        ? {
            status: verified.status,
            createdAt: verified.createdAt,
          }
        : null,
      vetted: vetted
        ? {
            status: vetted.status,
            createdAt: vetted.createdAt,
          }
        : null,
    };
  },
});

export const applyForVerification = mutation({
  args: {
    userId: v.string(),
    type: v.union(v.literal("verified"), v.literal("vetted")),
    documentUrl: v.optional(v.id("_storage")),
    additionalInfo: v.optional(v.string()),
  },
  returns: v.id("verifications"),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    // Check if application already exists
    const existing = await ctx.db
      .query("verifications")
      .withIndex("by_userId_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
      .first();

    if (existing) {
      // Update existing application
      await ctx.db.patch(existing._id, {
        status: "pending",
        applicationData: {
          documentUrl: args.documentUrl,
          additionalInfo: args.additionalInfo,
        },
        reviewedAt: undefined,
      });
      return existing._id;
    }

    // Create new application
    return await ctx.db.insert("verifications", {
      userId: args.userId,
      type: args.type,
      status: "pending",
      applicationData: {
        documentUrl: args.documentUrl,
        additionalInfo: args.additionalInfo,
      },
      createdAt: Date.now(),
    });
  },
});
