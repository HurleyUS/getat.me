import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwner } from "../lib/convex-auth";

export const getSectionsByHandle = query({
  args: { handle: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .first();
    if (!user) return [];

    const sections = await ctx.db
      .query("sections")
      .withIndex("by_userId", (q) => q.eq("userId", user.userId))
      .collect();

    return sections.sort((a, b) => a.weight - b.weight);
  },
});

export const getUserSections = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = args.userId;
    if (!userId) return [];

    const sections = await ctx.db
      .query("sections")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return sections.sort((a, b) => a.weight - b.weight);
  },
});

export const createSection = mutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    description: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  returns: v.id("sections"),
  handler: async (ctx, args) => {
    const userId = await requireOwner(ctx, args.userId);

    // Get current max weight
    const existing = await ctx.db
      .query("sections")
      .withIndex("by_userId", (q) => q.eq("userId", userId!))
      .collect();
    const maxWeight = existing.reduce((max, s) => Math.max(max, s.weight), -1);

    return await ctx.db.insert("sections", {
      userId: userId!,
      name: args.name,
      weight: maxWeight + 1,
      icon: args.icon,
      description: args.description,
    });
  },
});

export const updateSection = mutation({
  args: {
    id: v.id("sections"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    description: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireOwner(ctx, args.userId);

    const section = await ctx.db.get(args.id);
    if (!section || section.userId !== userId) {
      throw new Error("Section not found");
    }

    const updateData: Record<string, unknown> = {};
    if (args.name !== undefined) updateData.name = args.name;
    if (args.icon !== undefined) updateData.icon = args.icon;
    if (args.description !== undefined) updateData.description = args.description;

    await ctx.db.patch(args.id, updateData);
    return null;
  },
});

export const deleteSection = mutation({
  args: {
    id: v.id("sections"),
    userId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireOwner(ctx, args.userId);

    const section = await ctx.db.get(args.id);
    if (!section || section.userId !== userId) {
      throw new Error("Section not found");
    }

    // Unassign all links from this section
    const links = await ctx.db
      .query("links")
      .withIndex("by_userId", (q) => q.eq("userId", userId!))
      .collect();
    for (const link of links) {
      if (link.sectionId === args.id) {
        await ctx.db.patch(link._id, { sectionId: undefined });
      }
    }

    await ctx.db.delete(args.id);
    return null;
  },
});

export const reorderSections = mutation({
  args: {
    sectionIds: v.array(v.id("sections")),
    userId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireOwner(ctx, args.userId);

    for (let i = 0; i < args.sectionIds.length; i++) {
      const section = await ctx.db.get(args.sectionIds[i]);
      if (section && section.userId === userId) {
        await ctx.db.patch(args.sectionIds[i], { weight: i });
      }
    }
    return null;
  },
});
