import { z } from "zod";
import plans from "../.config/plans";

const itemSchema = z.object({
  id: z.string().min(1),
  status: z.enum([
    "active",
    "canceled",
    "ended",
    "expired",
    "incomplete",
    "past_due",
    "upcoming",
    "abandoned",
  ]),
  plan_id: z.string().nullable().optional(),
  plan: z.object({ id: z.string() }).nullable().optional(),
  period_end: z.number().int().nonnegative().nullable(),
});

const snapshotSchema = z.object({
  id: z.string().min(1),
  object: z.literal("commerce_subscription"),
  updated_at: z.number().int().nonnegative(),
  payer: z.object({
    user_id: z.string().optional(),
    organization_id: z.string().nullable().optional(),
  }),
  items: z.array(itemSchema).max(100),
});

/** Parse Clerk's webhook-specific `items` snapshot only after Svix verification. */
export function parseClerkSubscription(event: unknown) {
  const envelope = z.object({ type: z.string(), data: z.unknown() }).parse(event);
  if (
    ![
      "subscription.created",
      "subscription.updated",
      "subscription.active",
      "subscription.pastDue",
    ].includes(envelope.type)
  )
    return null;
  const data = snapshotSchema.parse(envelope.data);
  if (data.payer.organization_id || !data.payer.user_id) return null;
  return {
    userId: data.payer.user_id,
    subscriptionId: data.id,
    updatedAt: data.updated_at,
    items: data.items.map((item) => {
      const planId = item.plan_id ?? item.plan?.id;
      if (!planId) throw new Error("Billing item has no plan ID");
      return { id: item.id, planId, status: item.status, periodEnd: item.period_end };
    }),
  };
}

/** Keep historical plan IDs compatible without changing any customer subscriptions. */
export function planFromId(planId: string): "premium" | "pro" | "promax" | undefined {
  if (planId === plans.premium.id) return "premium";
  if (planId === plans.pro.id || planId === "cplan_34mvyFU9PuD9UMnKRtBd8SKF8Lf") return "pro";
  if (planId === plans.promax.id || planId === "cplan_34mwfWNyDG0w7w1feCVi4tmm6y9") return "promax";
}

/** Trials are active; cancellation keeps access through the paid/trial period end. */
export function highestClerkPlan(
  items: { planId: string; status: string; periodEnd: number | null }[],
  now: number,
) {
  const rank = { free: 0, premium: 1, pro: 2, promax: 3 };
  let highest: keyof typeof rank = "free";
  for (const item of items) {
    const plan = planFromId(item.planId);
    const current = item.periodEnd === null ? item.status === "active" : item.periodEnd > now;
    if (
      plan &&
      current &&
      (item.status === "active" || item.status === "canceled") &&
      rank[plan] > rank[highest]
    )
      highest = plan;
  }
  return highest;
}
