import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { getHandleError, RESERVED_HANDLES } from "../lib/handles";

const modules = {
  "../convex/users.ts": () => import("../convex/users"),
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
};

describe("a creator can safely claim and reopen a profile", () => {
  test("claims a normalized handle once, including a repeated submission", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner" });
    const id = await owner.mutation(api.users.setHandle, { handle: "  Studio_One  " });
    expect(await owner.mutation(api.users.setHandle, { handle: "studio_one" })).toBe(id);
    const profile = await owner.query(api.users.getCurrentUserProfile, {});
    expect(profile?.handle).toBe("studio_one");
    expect(profile?.userId).toBe("owner");
  });

  test("a late or retried account webhook preserves the claimed profile", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner" });
    const id = await owner.mutation(api.users.setHandle, { handle: "studio_one" });
    expect(await t.mutation(internal.users.createUser, { userId: "owner" })).toBe(id);
    expect((await owner.query(api.users.getCurrentUserProfile, {}))?.handle).toBe("studio_one");
  });

  test("rejects anonymous claims and impersonation through a supplied user ID", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.users.setHandle, { handle: "studio_one", userId: "owner" }),
    ).rejects.toThrow("sign in");
    const attacker = t.withIdentity({ subject: "attacker" });
    await expect(
      attacker.mutation(api.users.setHandle, { handle: "studio_one", userId: "owner" }),
    ).rejects.toThrow("own account");
    expect(await t.query(api.users.getUserByHandle, { handle: "studio_one" })).toBeNull();
  });

  test("prevents claiming a handle already owned by someone else", async () => {
    const t = convexTest(schema, modules);
    await t
      .withIdentity({ subject: "owner" })
      .mutation(api.users.setHandle, { handle: "studio_one" });
    await expect(
      t.withIdentity({ subject: "other" }).mutation(api.users.setHandle, { handle: "STUDIO_ONE" }),
    ).rejects.toThrow("already taken");
  });

  test("alternate profile mutations cannot bypass ownership or handle rules", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner" });
    const attacker = t.withIdentity({ subject: "attacker" });
    await owner.mutation(api.users.setHandle, { handle: "studio_one" });
    await expect(
      t.mutation(api.users.createUserPublic, { userId: "victim", handle: "fake" }),
    ).rejects.toThrow("own profile");
    await expect(
      attacker.mutation(api.users.updateUser, { userId: "owner", handle: "stolen" }),
    ).rejects.toThrow("own profile");
    await expect(attacker.mutation(api.users.deleteUser, { userId: "owner" })).rejects.toThrow(
      "own profile",
    );
    await expect(
      owner.mutation(api.users.updateUser, { userId: "owner", handle: "pricing" }),
    ).rejects.toThrow("reserved");
    expect((await owner.query(api.users.getCurrentUserProfile, {}))?.handle).toBe("studio_one");
  });

  test("an owner can edit their profile but cannot self-assign a paid plan", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner" });
    await owner.mutation(api.users.setHandle, { handle: "studio_one" });
    await owner.mutation(api.users.updateUser, { userId: "owner", bio: "Book a consultation" });
    expect((await owner.query(api.users.getCurrentUserProfile, {}))?.bio).toBe(
      "Book a consultation",
    );
    await expect(
      owner.mutation(api.users.updateUser, {
        userId: "owner",
        subscriptionPlan: "promax",
      } as never),
    ).rejects.toThrow();
    expect(
      (await owner.query(api.users.getCurrentUserProfile, {}))?.subscriptionPlan,
    ).toBeUndefined();
  });

  test.each([
    "ab",
    "a".repeat(33),
    "studio/one",
    "pricing",
    "register",
    "account",
    "contact",
    "upgraded",
  ])("rejects unusable profile URL %s", async (handle) => {
    const t = convexTest(schema, modules);
    await expect(
      t.withIdentity({ subject: "owner" }).mutation(api.users.setHandle, { handle }),
    ).rejects.toThrow();
  });

  test("reads customized paid profiles without a return validation error", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        userId: "owner",
        handle: "studio_one",
        subscriptionPlan: "promax",
        brandColor: "#123456",
        fontFamily: "sans",
        buttonStyle: "rounded",
        backgroundType: "solid",
        backgroundColor: "#ffffff",
      });
    });
    const profile = await t
      .withIdentity({ subject: "owner" })
      .query(api.users.getCurrentUserProfile, {});
    expect(profile?.subscriptionPlan).toBe("promax");
    expect(profile?.brandColor).toBe("#123456");
    expect((await t.query(api.users.getUserByHandle, { handle: "studio_one" }))?.fontFamily).toBe(
      "sans",
    );
    expect(await t.query(api.users.getCurrentUserProfile, { userId: "owner" })).toBeNull();
    await expect(
      t
        .withIdentity({ subject: "other" })
        .query(api.users.getCurrentUserProfile, { userId: "owner" }),
    ).rejects.toThrow("own account");
  });

  test("the client validator reserves every static application page", async () => {
    const routes = Array.from(
      new Bun.Glob("*/page.tsx").scanSync({ cwd: `${import.meta.dir}/../app` }),
    );
    for (const route of routes) {
      const segment = route.split("/")[0];
      if (!segment.startsWith("[")) expect(RESERVED_HANDLES.has(segment)).toBe(true);
    }
    expect(getHandleError("a".repeat(32))).toBeNull();
  });
});
