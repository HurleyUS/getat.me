import { requireOwner } from "../lib/convex-auth";
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { highestClerkPlan, planFromId } from "../lib/clerk-billing";

/** Materialize only verified billing state; existing Stripe records stay intact. */
async function reconcileClerkPlan(ctx: MutationCtx, userId: string) {
  const snapshot = await ctx.db
    .query("clerkBillingSnapshots")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (!snapshot) return;
  const now = Date.now();
  const legacy = await ctx.db
    .query("subscriptions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(100);
  // Fail visibly rather than silently truncate a customer's historical subscriptions.
  if (legacy.length === 100) throw new Error("Legacy subscription reconciliation requires review");
  if (legacy.some((item) => item.expires > now && !planFromId(item.priceId))) {
    throw new Error("An active legacy subscription requires an explicit plan mapping");
  }
  const items = [
    ...snapshot.items,
    ...legacy.map((item) => ({ planId: item.priceId, status: "active", periodEnd: item.expires })),
  ];
  const subscriptionPlan = highestClerkPlan(items, now);
  const user = await ctx.db
    .query("users")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (user) await ctx.db.patch(user._id, { subscriptionPlan });
  else await ctx.db.insert("users", { userId, subscriptionPlan });
  const ends = items
    .filter(
      (item) =>
        (item.status === "active" || item.status === "canceled") &&
        item.periodEnd !== null &&
        item.periodEnd > now,
    )
    .map((item) => item.periodEnd as number);
  if (ends.length)
    await ctx.scheduler.runAt(Math.min(...ends), internal.subscriptions.expireClerkPlan, {
      userId,
      updatedAt: snapshot.updatedAt,
    });
}

export const applyClerkSnapshot = internalMutation({
  args: {
    userId: v.string(),
    subscriptionId: v.string(),
    updatedAt: v.number(),
    items: v.array(
      v.object({
        id: v.string(),
        planId: v.string(),
        status: v.string(),
        periodEnd: v.union(v.number(), v.null()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const previous = await ctx.db
      .query("clerkBillingSnapshots")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (previous && previous.updatedAt >= args.updatedAt) return null;
    if (previous) await ctx.db.replace(previous._id, args);
    else await ctx.db.insert("clerkBillingSnapshots", args);
    await reconcileClerkPlan(ctx, args.userId);
    return null;
  },
});

export const expireClerkPlan = internalMutation({
  args: { userId: v.string(), updatedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const snapshot = await ctx.db
      .query("clerkBillingSnapshots")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (snapshot?.updatedAt === args.updatedAt) await reconcileClerkPlan(ctx, args.userId);
    return null;
  },
});

export const createSubscription = internalMutation({
  args: {
    key: v.string(),
    value: v.string(),
    subscriptionId: v.string(),
    priceId: v.string(),
    expires: v.number(),
  },
  handler: async (ctx, args) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await ctx.db
      .query("users")
      .withIndex(`by_${args.key}` as "by_userId", (q) => q.eq("userId" as never, args.value))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    const subscription = {
      userId: user.userId,
      subscriptionId: args.subscriptionId,
      priceId: args.priceId,
      expires: args.expires,
    };

    return await ctx.db.insert("subscriptions", subscription);
  },
});

export const getSubscriptionsBy = query({
  args: {
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    if (args.key === "userId" && args.value !== owner)
      throw new Error("You can only access your own account");
    switch (args.key) {
      case "subscriptionId": {
        const subscription = await ctx.db
          .query("subscriptions")
          .withIndex("by_subscriptionId", (q) => q.eq("subscriptionId", args.value))
          .first();
        if (subscription?.userId !== owner) return null;
        return subscription;
      }
      case "priceId":
        return await ctx.db
          .query("subscriptions")
          .withIndex("by_priceId", (q) => q.eq("priceId", args.value))
          .filter((q) => q.eq(q.field("userId"), owner))
          .collect();
      case "userId":
        return await ctx.db
          .query("subscriptions")
          .withIndex("by_userId", (q) => q.eq("userId", args.value))
          .collect();
      default:
        throw new Error("Invalid key");
    }
  },
});

export const renewSubscription = internalMutation({
  args: {
    subscriptionId: v.string(),
    expires: v.number(),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_subscriptionId", (q) => q.eq("subscriptionId", args.subscriptionId))
      .first();

    if (!subscription || Array.isArray(subscription)) {
      throw new Error("Subscription not found");
    }

    return await ctx.db.patch(subscription._id, { expires: args.expires });
  },
});

// Helper function to map priceId to plan slug
function getPlanSlugFromPriceId(priceId: string): string | undefined {
  return planFromId(priceId);
}

export const updateUserSubscriptionPlan = internalMutation({
  args: {
    userId: v.string(),
    priceId: v.string(),
  },
  handler: async (ctx, args) => {
    const planSlug = getPlanSlugFromPriceId(args.priceId);
    if (!planSlug) {
      return; // Unknown plan, skip update
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, { subscriptionPlan: planSlug });
  },
});
