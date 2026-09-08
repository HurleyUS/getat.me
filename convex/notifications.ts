import { requireOwner } from "../lib/convex-auth";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getNotificationSettings = query({
  args: {
    userId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("notificationSettings"),
      _creationTime: v.number(),
      userId: v.string(),
      emailNotifications: v.boolean(),
      bookingNotifications: v.boolean(),
      messageNotifications: v.boolean(),
      referralNotifications: v.boolean(),
      reviewNotifications: v.boolean(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    return await ctx.db
      .query("notificationSettings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const updateNotificationSettings = mutation({
  args: {
    userId: v.string(),
    emailNotifications: v.optional(v.boolean()),
    bookingNotifications: v.optional(v.boolean()),
    messageNotifications: v.optional(v.boolean()),
    referralNotifications: v.optional(v.boolean()),
    reviewNotifications: v.optional(v.boolean()),
  },
  returns: v.id("notificationSettings"),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const existing = await ctx.db
      .query("notificationSettings")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    const now = Date.now();
    const updateData: {
      emailNotifications?: boolean;
      bookingNotifications?: boolean;
      messageNotifications?: boolean;
      referralNotifications?: boolean;
      reviewNotifications?: boolean;
      updatedAt: number;
    } = {
      updatedAt: now,
    };

    if (args.emailNotifications !== undefined)
      updateData.emailNotifications = args.emailNotifications;
    if (args.bookingNotifications !== undefined)
      updateData.bookingNotifications = args.bookingNotifications;
    if (args.messageNotifications !== undefined)
      updateData.messageNotifications = args.messageNotifications;
    if (args.referralNotifications !== undefined)
      updateData.referralNotifications = args.referralNotifications;
    if (args.reviewNotifications !== undefined)
      updateData.reviewNotifications = args.reviewNotifications;

    if (existing) {
      await ctx.db.patch(existing._id, updateData);
      return existing._id;
    } else {
      return await ctx.db.insert("notificationSettings", {
        userId: args.userId,
        emailNotifications: args.emailNotifications ?? true,
        bookingNotifications: args.bookingNotifications ?? true,
        messageNotifications: args.messageNotifications ?? true,
        referralNotifications: args.referralNotifications ?? true,
        reviewNotifications: args.reviewNotifications ?? true,
        updatedAt: now,
      });
    }
  },
});
