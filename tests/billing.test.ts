import { afterEach, beforeEach, describe, expect, setSystemTime, test } from "bun:test";
import { convexTest } from "convex-test";
import { Webhook } from "svix";
import plans from "../.config/plans";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { highestClerkPlan, parseClerkSubscription } from "../lib/clerk-billing";

const modules = {
  "../convex/users.ts": () => import("../convex/users"),
  "../convex/subscriptions.ts": () => import("../convex/subscriptions"),
  "../convex/clerk.ts": () => import("../convex/clerk"),
  "../convex/http.ts": () => import("../convex/http"),
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
};
const now = Date.UTC(2026, 8, 8);
const secret = `whsec_${Buffer.from("getatme-webhook-regression-test-only").toString("base64")}`;
const originalSecret = process.env.CLERK_CONVEX_WEBHOOK_SECRET;

// Minimum fields used from Clerk's documented webhook-specific JSON interface:
// https://github.com/clerk/javascript/blob/main/packages/backend/src/api/resources/JSON.ts
function event(
  options: { status?: string; end?: number | null; updatedAt?: number; planId?: string } = {},
) {
  return {
    type: "subscription.updated",
    data: {
      object: "commerce_subscription",
      id: "csub_test",
      updated_at: options.updatedAt ?? now,
      payer: { user_id: "owner" },
      items: [
        {
          id: "item_test",
          plan_id: options.planId ?? plans.pro.id,
          status: options.status ?? "active",
          period_end: options.end === undefined ? now + 60_000 : options.end,
          is_free_trial: true,
        },
      ],
    },
  };
}

function signedRequest(value: unknown, valid = true) {
  const payload = JSON.stringify(value);
  const id = "msg_billing_test";
  const signature = new Webhook(secret).sign(id, new Date(), payload);
  return new Request("https://test.convex.site/clerk", {
    method: "POST",
    headers: {
      "svix-id": id,
      "svix-timestamp": String(Math.floor(Date.now() / 1000)),
      "svix-signature": valid ? signature : "v1,invalid",
    },
    body: payload,
  });
}

beforeEach(() => {
  setSystemTime(now);
  process.env.CLERK_CONVEX_WEBHOOK_SECRET = secret;
});
afterEach(() => {
  setSystemTime();
  if (originalSecret === undefined) delete process.env.CLERK_CONVEX_WEBHOOK_SECRET;
  else process.env.CLERK_CONVEX_WEBHOOK_SECRET = originalSecret;
});

describe("verified Clerk billing fulfills the purchased plan", () => {
  test("a signed trial snapshot unlocks Pro and preserves an existing profile", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner" });
    await owner.mutation(api.users.setHandle, { handle: "studio_one" });
    const request = signedRequest(event());
    const response = await t.fetch("/clerk", {
      method: request.method,
      headers: request.headers,
      body: await request.text(),
    });
    expect(response.status).toBe(200);
    const profile = await owner.query(api.users.getCurrentUserProfile, {});
    expect(profile?.handle).toBe("studio_one");
    expect(profile?.subscriptionPlan).toBe("pro");
  });

  test("an invalid signature cannot create an account or grant a paid plan", async () => {
    const t = convexTest(schema, modules);
    const request = signedRequest(event(), false);
    const response = await t.fetch("/clerk", {
      method: request.method,
      headers: request.headers,
      body: await request.text(),
    });
    expect(response.status).toBe(400);
    expect(await t.run((ctx) => ctx.db.query("clerkBillingSnapshots").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(0);
  });

  test("retries and older deliveries cannot undo a more recent upgrade", async () => {
    const t = convexTest(schema, modules);
    const newer = parseClerkSubscription(event({ planId: plans.promax.id, updatedAt: now + 2 }))!;
    await t.mutation(internal.subscriptions.applyClerkSnapshot, newer);
    await t.mutation(internal.subscriptions.applyClerkSnapshot, newer);
    await t.mutation(
      internal.subscriptions.applyClerkSnapshot,
      parseClerkSubscription(event({ status: "ended" }))!,
    );
    expect(await t.run((ctx) => ctx.db.query("clerkBillingSnapshots").collect())).toHaveLength(1);
    expect(
      (await t.withIdentity({ subject: "owner" }).query(api.users.getCurrentUserProfile, {}))
        ?.subscriptionPlan,
    ).toBe("promax");
  });

  test("cancellation keeps access until period end, then expires without another webhook", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(
      internal.subscriptions.applyClerkSnapshot,
      parseClerkSubscription(event({ status: "canceled" }))!,
    );
    const owner = t.withIdentity({ subject: "owner" });
    expect((await owner.query(api.users.getCurrentUserProfile, {}))?.subscriptionPlan).toBe("pro");
    setSystemTime(now + 60_001);
    await t.mutation(internal.subscriptions.expireClerkPlan, { userId: "owner", updatedAt: now });
    expect((await owner.query(api.users.getCurrentUserProfile, {}))?.subscriptionPlan).toBe("free");
  });

  test("a stale expiry job cannot revoke a renewed subscription", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.subscriptions.applyClerkSnapshot, parseClerkSubscription(event())!);
    await t.mutation(
      internal.subscriptions.applyClerkSnapshot,
      parseClerkSubscription(event({ updatedAt: now + 1, end: now + 120_000 }))!,
    );
    setSystemTime(now + 60_001);
    await t.mutation(internal.subscriptions.expireClerkPlan, { userId: "owner", updatedAt: now });
    expect(
      (await t.withIdentity({ subject: "owner" }).query(api.users.getCurrentUserProfile, {}))
        ?.subscriptionPlan,
    ).toBe("pro");
  });

  test("existing legacy subscriptions retain their paid period and original records", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        userId: "owner",
        subscriptionId: "legacy_sub",
        priceId: "cplan_34mwfWNyDG0w7w1feCVi4tmm6y9",
        expires: now + 120_000,
      });
    });
    await t.mutation(
      internal.subscriptions.applyClerkSnapshot,
      parseClerkSubscription(event({ status: "ended" }))!,
    );
    expect(
      (await t.withIdentity({ subject: "owner" }).query(api.users.getCurrentUserProfile, {}))
        ?.subscriptionPlan,
    ).toBe("promax");
    expect((await t.run((ctx) => ctx.db.query("subscriptions").collect()))[0].subscriptionId).toBe(
      "legacy_sub",
    );
  });

  test.each([
    "upcoming",
    "incomplete",
    "past_due",
    "ended",
    "expired",
    "abandoned",
  ])("%s cannot grant paid access", (status) => {
    expect(highestClerkPlan(parseClerkSubscription(event({ status }))!.items, now)).toBe("free");
  });

  test("a deferred downgrade keeps the higher current plan until its period ends", () => {
    const items = [
      { planId: plans.promax.id, status: "canceled", periodEnd: now + 60_000 },
      { planId: plans.pro.id, status: "upcoming", periodEnd: null },
    ];
    expect(highestClerkPlan(items, now)).toBe("promax");
    expect(highestClerkPlan(items, now + 60_000)).toBe("free");
  });

  test("malformed known events fail visibly; unrelated or organization events are ignored", () => {
    expect(() => parseClerkSubscription({ type: "subscription.updated", data: {} })).toThrow();
    expect(parseClerkSubscription({ type: "paymentAttempt.updated", data: {} })).toBeNull();
    const organization = event();
    organization.data.payer = { organization_id: "org_test" } as never;
    expect(parseClerkSubscription(organization)).toBeNull();
    expect(highestClerkPlan([{ planId: "unknown", status: "active", periodEnd: null }], now)).toBe(
      "free",
    );
  });
});
