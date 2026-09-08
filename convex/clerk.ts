"use node";

import type { WebhookEvent } from "@clerk/clerk-sdk-node";
import { internalAction } from "./_generated/server";
import { Webhook } from "svix";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { parseClerkSubscription } from "../lib/clerk-billing";

export const fulfill = internalAction({
  args: {
    headers: v.object({
      "svix-id": v.string(),
      "svix-timestamp": v.string(),
      "svix-signature": v.string(),
    }),
    payload: v.string(),
  },
  // User events retain Clerk's existing external payload shape.
  returns: v.any(),
  handler: async (ctx, args) => {
    const wh = new Webhook(process.env.CLERK_CONVEX_WEBHOOK_SECRET as string);
    const payload = wh.verify(args.payload, args.headers) as WebhookEvent;
    const snapshot = parseClerkSubscription(payload);
    if (snapshot) await ctx.runMutation(internal.subscriptions.applyClerkSnapshot, snapshot);
    return payload;
  },
});
