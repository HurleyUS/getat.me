import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwner } from "../lib/convex-auth";

export const createLink = mutation({
  args: {
    anchor: v.string(),
    href: v.string(),
    weight: v.optional(v.number()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    sectionId: v.optional(v.id("sections")),
    publishAt: v.optional(v.number()),
    unpublishAt: v.optional(v.number()),
    userId: v.optional(v.string()),
  },
  returns: v.id("links"),
  handler: async (ctx, args) => {
    const userId = await requireOwner(ctx, args.userId);
    if (args.sectionId) {
      const section = await ctx.db.get(args.sectionId);
      if (section?.userId !== userId) throw new Error("Section not found");
    }

    return await ctx.db.insert("links", {
      userId,
      anchor: args.anchor,
      href: args.href,
      weight: args.weight,
      color: args.color,
      icon: args.icon,
      sectionId: args.sectionId,
      publishAt: args.publishAt,
      unpublishAt: args.unpublishAt,
    });
  },
});

export const getUserLinksByHandle = query({
  args: {
    handle: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const links = await ctx.db
      .query("links")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect();

    // Filter out links that aren't live (for public view)
    const now = Date.now();
    const liveLinks = links.filter((link) => {
      if (link.publishAt && link.publishAt > now) return false;
      if (link.unpublishAt && link.unpublishAt <= now) return false;
      return true;
    });

    // Sort by weight (lower weight = higher priority), then by creation time
    return liveLinks.sort((a, b) => {
      const weightA = a.weight ?? 999;
      const weightB = b.weight ?? 999;
      if (weightA !== weightB) return weightA - weightB;
      return 0;
    });
  },
});

// Dashboard query: returns ALL links (including scheduled/expired) for the owner
export const getDashboardLinksByHandle = query({
  args: {
    handle: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await requireOwner(ctx, user.userId);
    const links = await ctx.db
      .query("links")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect();

    // Sort by weight (lower weight = higher priority), then by creation time
    return links.sort((a, b) => {
      const weightA = a.weight ?? 999;
      const weightB = b.weight ?? 999;
      if (weightA !== weightB) return weightA - weightB;
      return 0;
    });
  },
});

export const updateLink = mutation({
  args: {
    id: v.id("links"),
    anchor: v.optional(v.string()),
    href: v.optional(v.string()),
    weight: v.optional(v.number()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    sectionId: v.optional(v.id("sections")),
    clearSection: v.optional(v.boolean()),
    publishAt: v.optional(v.number()),
    unpublishAt: v.optional(v.number()),
    clearPublishAt: v.optional(v.boolean()),
    clearUnpublishAt: v.optional(v.boolean()),
    userId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireOwner(ctx, args.userId);
    if (args.sectionId) {
      const section = await ctx.db.get(args.sectionId);
      if (section?.userId !== userId) throw new Error("Section not found");
    }

    const link = await ctx.db.get(args.id);

    if (!link) {
      throw new Error("Link not found");
    }

    if (link.userId !== userId) {
      throw new Error("Link not found");
    }

    // Build update object excluding id and userId
    const updateData: Record<string, unknown> = {};
    if (args.anchor !== undefined) updateData.anchor = args.anchor;
    if (args.href !== undefined) updateData.href = args.href;
    if (args.weight !== undefined) updateData.weight = args.weight;
    if (args.color !== undefined) updateData.color = args.color;
    if (args.icon !== undefined) updateData.icon = args.icon;
    if (args.sectionId !== undefined) updateData.sectionId = args.sectionId;
    if (args.clearSection) updateData.sectionId = undefined;
    if (args.publishAt !== undefined) updateData.publishAt = args.publishAt;
    if (args.clearPublishAt) updateData.publishAt = undefined;
    if (args.unpublishAt !== undefined) updateData.unpublishAt = args.unpublishAt;
    if (args.clearUnpublishAt) updateData.unpublishAt = undefined;

    await ctx.db.patch(args.id, updateData);
    return null;
  },
});

export const deleteLink = mutation({
  args: {
    id: v.id("links"),
    userId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireOwner(ctx, args.userId);

    const link = await ctx.db.get(args.id);

    if (!link) {
      throw new Error("Link not found");
    }

    if (link.userId !== userId) {
      throw new Error("Link not found");
    }

    await ctx.db.delete(args.id);
    return null;
  },
});

export const reorderLinks = mutation({
  args: {
    linkIds: v.array(v.id("links")),
    userId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireOwner(ctx, args.userId);

    // Update each link with its new weight based on array position
    for (let i = 0; i < args.linkIds.length; i++) {
      const link = await ctx.db.get(args.linkIds[i]);
      if (link && link.userId === userId) {
        await ctx.db.patch(args.linkIds[i], { weight: i });
      }
    }

    return null;
  },
});
