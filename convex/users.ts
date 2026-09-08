import { v } from "convex/values";
import { getHandleError } from "../lib/handles";
import {
  ActionCtx,
  MutationCtx,
  QueryCtx,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

const profileValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  userId: v.string(),
  handle: v.optional(v.string()),
  first: v.optional(v.string()),
  last: v.optional(v.string()),
  phone: v.optional(v.string()),
  email: v.optional(v.string()),
  avatar: v.optional(v.id("_storage")),
  cover: v.optional(v.id("_storage")),
  bio: v.optional(v.string()),
  theme: v.optional(v.string()),
  brandColor: v.optional(v.string()),
  fontFamily: v.optional(v.string()),
  buttonStyle: v.optional(v.string()),
  backgroundType: v.optional(v.string()),
  backgroundColor: v.optional(v.string()),
  backgroundImage: v.optional(v.id("_storage")),
  subscriptionPlan: v.optional(v.string()),
  avatarUrl: v.optional(v.string()),
  coverUrl: v.optional(v.string()),
});

export async function getCurrentUser(ctx: QueryCtx | MutationCtx | ActionCtx, id?: boolean) {
  const user = await ctx.auth.getUserIdentity();

  if (id) {
    return user?.subject;
  }

  return user;
}

export const getUserByID = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      return null;
    }

    // Get URLs for avatar and cover
    const avatarUrl = user.avatar ? await ctx.storage.getUrl(user.avatar) : undefined;
    const coverUrl = user.cover ? await ctx.storage.getUrl(user.cover) : undefined;

    return {
      ...user,
      avatarUrl: avatarUrl ?? undefined,
      coverUrl: coverUrl ?? undefined,
    };
  },
});

export const internalUserHandleByID = internalQuery({
  args: {
    userId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      return "";
    }

    if (!user.handle) {
      return "";
    }

    return user.handle;
  },
});

export const getUserByHandle = query({
  args: {
    handle: v.string(),
  },
  returns: v.union(profileValidator, v.null()),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .first();

    if (!profile) {
      return null;
    }

    // Get URLs for avatar and cover
    const avatarUrl = profile.avatar ? await ctx.storage.getUrl(profile.avatar) : undefined;
    const coverUrl = profile.cover ? await ctx.storage.getUrl(profile.cover) : undefined;

    return {
      ...profile,
      avatarUrl: avatarUrl ?? undefined,
      coverUrl: coverUrl ?? undefined,
    };
  },
});

export const getUserByEmail = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

export const getUserByPhone = query({
  args: {
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();
  },
});

export const getUserBy = query({
  args: {
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const { key, value } = args;

    if (key in ["email", "phone", "userId", "handle"]) {
      switch (key) {
        case "email":
          return await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", value))
            .first();
        case "phone":
          return await ctx.db
            .query("users")
            .withIndex("by_phone", (q) => q.eq("phone", value))
            .first();
        case "userId":
          return await ctx.db
            .query("users")
            .withIndex("by_userId", (q) => q.eq("userId", value))
            .first();
        case "handle":
          return await ctx.db
            .query("users")
            .withIndex("by_handle", (q) => q.eq("handle", value))
            .first();
      }
    }
  },
});

export const createUser = internalMutation({
  args: {
    userId: v.string(),
    handle: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    first: v.optional(v.string()),
    last: v.optional(v.string()),
    avatar: v.optional(v.id("_storage")),
    cover: v.optional(v.id("_storage")),
    bio: v.optional(v.string()),
    theme: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("users", args);
  },
});

export const createUserPublic = mutation({
  args: {
    userId: v.string(),
    handle: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    first: v.optional(v.string()),
    last: v.optional(v.string()),
    avatar: v.optional(v.id("_storage")),
    cover: v.optional(v.id("_storage")),
    bio: v.optional(v.string()),
    theme: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("You can only create your own profile.");
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();
    if (existing) return existing._id;
    if (args.handle !== undefined) {
      args.handle = args.handle.trim().toLowerCase();
      const handleError = getHandleError(args.handle);
      if (handleError) throw new Error(handleError);
      const claimed = await ctx.db
        .query("users")
        .withIndex("by_handle", (q) => q.eq("handle", args.handle))
        .first();
      if (claimed) throw new Error("Handle is already taken");
    }
    return await ctx.db.insert("users", args);
  },
});

export const updateUser = mutation({
  args: {
    userId: v.string(),
    handle: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    first: v.optional(v.string()),
    last: v.optional(v.string()),
    avatar: v.optional(v.id("_storage")),
    cover: v.optional(v.id("_storage")),
    bio: v.optional(v.string()),
    theme: v.optional(v.string()),
    brandColor: v.optional(v.string()),
    fontFamily: v.optional(v.string()),
    buttonStyle: v.optional(v.string()),
    backgroundType: v.optional(v.string()),
    backgroundColor: v.optional(v.string()),
    backgroundImage: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("You can only update your own profile.");
    }
    if (args.handle !== undefined) {
      args.handle = args.handle.trim().toLowerCase();
      const handleError = getHandleError(args.handle);
      if (handleError) throw new Error(handleError);
      const claimed = await ctx.db
        .query("users")
        .withIndex("by_handle", (q) => q.eq("handle", args.handle))
        .first();
      if (claimed && claimed.userId !== identity.subject)
        throw new Error("Handle is already taken");
    }
    // we won't update the userId so clone args and drop it
    const prev = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!prev) {
      throw new Error("User not found");
    }

    const user = { ...prev, ...args };
    await ctx.db.patch(prev._id, user);
    return null;
  },
});

export const internalUpdateUser = internalMutation({
  args: {
    userId: v.string(),
    email: v.optional(v.string()),
    first: v.optional(v.string()),
    last: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      // User doesn't exist yet — skip update
      return;
    }

    const { userId: _, ...updates } = args;
    await ctx.db.patch(user._id, updates);
  },
});

export const internalDeleteUser = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      return;
    }

    await ctx.db.delete(user._id);
  },
});

export const deleteUser = mutation({
  args: {
    userId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("You can only delete your own profile.");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.delete(user._id);
    return null;
  },
});

export const getUserSubscriptions = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const userHasFeature = query({
  args: {
    userId: v.string(),
    feature: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Map of feature names to price IDs that grant those features
    // ProMax plan has unlimited_links feature
    const featurePriceIds: Record<string, string[]> = {
      unlimited_links: ["cplan_34mvyFU9PuD9UMnKRtBd8SKF8Lf", "cplan_34mwfWNyDG0w7w1feCVi4tmm6y9"], // Pro and ProMax
    };

    const priceIds = featurePriceIds[args.feature];
    if (!priceIds || priceIds.length === 0) {
      return false;
    }

    // Get all subscriptions for this user
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Check if user has an active subscription with any of the price IDs that grant this feature
    const now = Date.now();
    return subscriptions.some((sub) => priceIds.includes(sub.priceId) && sub.expires > now);
  },
});

export const isHandleUnique = query({
  args: {
    handle: v.string(),
  },
  handler: async (ctx, args) => {
    const handle = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", args.handle))
      .first();

    return !handle;
  },
});

export const getCurrentUserProfile = query({
  args: {
    userId: v.optional(v.string()),
  },
  returns: v.union(profileValidator, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    if (args.userId && args.userId !== identity.subject) {
      throw new Error("You can only access your own account.");
    }
    const userId = identity.subject;

    const profile = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      return null;
    }

    // Get URLs for avatar and cover
    const avatarUrl = profile.avatar ? await ctx.storage.getUrl(profile.avatar) : undefined;
    const coverUrl = profile.cover ? await ctx.storage.getUrl(profile.cover) : undefined;

    return {
      ...profile,
      avatarUrl: avatarUrl ?? undefined,
      coverUrl: coverUrl ?? undefined,
    };
  },
});

export const uploadAvatar = mutation({
  args: {
    userId: v.string(),
    fileId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("You can only update your own profile.");
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!currentUser) {
      // Create user if doesn't exist
      await ctx.db.insert("users", {
        userId: args.userId,
        avatar: args.fileId,
      });
    } else {
      // Update user with avatar
      await ctx.db.patch(currentUser._id, {
        avatar: args.fileId,
      });
    }
    return null;
  },
});

export const uploadCover = mutation({
  args: {
    userId: v.string(),
    fileId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("You can only update your own profile.");
    }
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!currentUser) {
      // Create user if doesn't exist
      await ctx.db.insert("users", {
        userId: args.userId,
        cover: args.fileId,
      });
    } else {
      // Update user with cover
      await ctx.db.patch(currentUser._id, {
        cover: args.fileId,
      });
    }
    return null;
  },
});

export const setHandle = mutation({
  args: {
    handle: v.string(),
    userId: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not found. Please sign in.");
    }
    if (args.userId && args.userId !== identity.subject) {
      throw new Error("You can only claim a handle for your own account.");
    }
    const userId = identity.subject;
    const handle = args.handle.trim().toLowerCase();
    const handleError = getHandleError(handle);
    if (handleError) throw new Error(handleError);

    // Check if handle is unique
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_handle", (q) => q.eq("handle", handle))
      .first();

    if (existingUser) {
      if (existingUser.userId === userId) return existingUser._id;
      throw new Error("Handle is already taken");
    }

    // Check if current user exists
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!currentUser) {
      // Create user if doesn't exist
      const newUserId = await ctx.db.insert("users", {
        userId: userId,
        handle,
      });
      return newUserId;
    } else {
      // Update user with handle
      await ctx.db.patch(currentUser._id, {
        handle,
      });
      return currentUser._id;
    }
  },
});

export const getAllPublicHandles = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => !!u.handle)
      .map((u) => ({
        handle: u.handle as string,
        _creationTime: u._creationTime,
      }));
  },
});

// Duplicate internalUpdateUser/internalDeleteUser removed — canonical versions above (line ~261)
