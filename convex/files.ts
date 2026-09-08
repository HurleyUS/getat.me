import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireOwner } from "../lib/convex-auth";

export const generateUploadUrl = mutation({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const url = await ctx.storage.generateUploadUrl();
    return { url };
  },
});

export const getFileUrl = query({
  args: { fileId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.fileId);
  },
});
