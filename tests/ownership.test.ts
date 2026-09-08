import { describe, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { createCommission, updateCommissionStatus } from "../convex/commissions";

const modules = {
  "../convex/users.ts": () => import("../convex/users"),
  "../convex/links.ts": () => import("../convex/links"),
  "../convex/sections.ts": () => import("../convex/sections"),
  "../convex/posts.ts": () => import("../convex/posts"),
  "../convex/messages.ts": () => import("../convex/messages"),
  "../convex/booking.ts": () => import("../convex/booking"),
  "../convex/payments.ts": () => import("../convex/payments"),
  "../convex/notifications.ts": () => import("../convex/notifications"),
  "../convex/recommendations.ts": () => import("../convex/recommendations"),
  "../convex/referrals.ts": () => import("../convex/referrals"),
  "../convex/commissions.ts": () => import("../convex/commissions"),
  "../convex/verifications.ts": () => import("../convex/verifications"),
  "../convex/files.ts": () => import("../convex/files"),
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
};

describe("public account IDs cannot authorize another person's data", () => {
  test("owners can manage links and sections; anonymous and impersonating callers cannot", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner" });
    await owner.mutation(api.users.setHandle, { handle: "studio_one" });
    const section = await owner.mutation(api.sections.createSection, { name: "Work" });
    const link = await owner.mutation(api.links.createLink, {
      anchor: "Book",
      href: "https://example.com",
      sectionId: section,
    });
    for (const actor of [t, t.withIdentity({ subject: "attacker" })]) {
      await expect(
        actor.mutation(api.links.createLink, {
          userId: "owner",
          anchor: "Fake",
          href: "https://example.com",
        }),
      ).rejects.toThrow();
      await expect(
        actor.mutation(api.links.updateLink, { userId: "owner", id: link, anchor: "Fake" }),
      ).rejects.toThrow();
      await expect(
        actor.mutation(api.links.deleteLink, { userId: "owner", id: link }),
      ).rejects.toThrow();
      await expect(
        actor.mutation(api.links.reorderLinks, { userId: "owner", linkIds: [link] }),
      ).rejects.toThrow();
      await expect(
        actor.mutation(api.sections.createSection, { userId: "owner", name: "Fake" }),
      ).rejects.toThrow();
      await expect(
        actor.mutation(api.sections.updateSection, { userId: "owner", id: section, name: "Fake" }),
      ).rejects.toThrow();
      await expect(
        actor.mutation(api.sections.deleteSection, { userId: "owner", id: section }),
      ).rejects.toThrow();
      await expect(
        actor.mutation(api.sections.reorderSections, { userId: "owner", sectionIds: [section] }),
      ).rejects.toThrow();
      await expect(
        actor.query(api.links.getDashboardLinksByHandle, { handle: "studio_one" }),
      ).rejects.toThrow();
    }
    const otherSection = await t
      .withIdentity({ subject: "other" })
      .mutation(api.sections.createSection, { name: "Other" });
    await expect(
      owner.mutation(api.links.updateLink, { id: link, sectionId: otherSection }),
    ).rejects.toThrow("Section not found");
    await owner.mutation(api.links.updateLink, { id: link, anchor: "Book me" });
    expect(
      (await t.query(api.links.getUserLinksByHandle, { handle: "studio_one" }))[0].anchor,
    ).toBe("Book me");
    await owner.mutation(api.sections.deleteSection, { id: section });
    expect(
      (await owner.query(api.links.getDashboardLinksByHandle, { handle: "studio_one" }))[0]
        .sectionId,
    ).toBeUndefined();
  });

  test("posts, reactions and reposts cannot be created, edited or deleted as another user", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner" });
    const postId = await owner.mutation(api.posts.createPost, {
      userId: "owner",
      content: "My work",
    });
    for (const actor of [t, t.withIdentity({ subject: "attacker" })]) {
      await expect(
        actor.mutation(api.posts.createPost, { userId: "owner", content: "Fake" }),
      ).rejects.toThrow();
      await expect(
        actor.mutation(api.posts.updatePost, { postId, content: "Fake" }),
      ).rejects.toThrow();
      await expect(actor.mutation(api.posts.deletePost, { postId })).rejects.toThrow();
      for (const fn of [
        api.posts.likePost,
        api.posts.unlikePost,
        api.posts.toggleLike,
        api.posts.repost,
        api.posts.undoRepost,
      ]) {
        await expect(actor.mutation(fn, { userId: "owner", postId })).rejects.toThrow();
      }
    }
    await owner.mutation(api.posts.updatePost, { postId, content: "Updated work" });
    expect((await t.run((ctx) => ctx.db.get(postId)))?.content).toBe("Updated work");
  });

  test("DMs remain private to the participants and cannot be sent as another person", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner" });
    const id = await owner.mutation(api.messages.sendMessage, {
      senderUserId: "owner",
      receiverUserId: "recipient",
      content: "Private details",
    });
    const outsider = t.withIdentity({ subject: "attacker" });
    await expect(
      outsider.mutation(api.messages.sendMessage, {
        senderUserId: "owner",
        receiverUserId: "recipient",
        content: "Fake",
      }),
    ).rejects.toThrow();
    await expect(
      outsider.query(api.messages.getConversations, { userId: "owner" }),
    ).rejects.toThrow();
    await expect(
      outsider.query(api.messages.getMessages, {
        userId1: "owner",
        userId2: "recipient",
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow();
    await expect(
      outsider.mutation(api.messages.markMessagesAsRead, {
        userId1: "owner",
        userId2: "recipient",
        readerUserId: "recipient",
      }),
    ).rejects.toThrow();
    await t.withIdentity({ subject: "recipient" }).mutation(api.messages.markMessagesAsRead, {
      userId1: "owner",
      userId2: "recipient",
      readerUserId: "recipient",
    });
    expect((await t.run((ctx) => ctx.db.get(id)))?.read).toBe(true);
  });

  test("visitors may book, but only the profile owner can read details or cancel", async () => {
    const t = convexTest(schema, modules);
    const owner = t.withIdentity({ subject: "owner" });
    await owner.mutation(api.booking.updateBookingAvailability, { userId: "owner", enabled: true });
    const id = await t.mutation(api.booking.createAppointment, {
      userId: "owner",
      name: "A Customer",
      email: "customer@example.test",
      appointmentDate: "2026-10-01",
      appointmentTime: "10:00",
    });
    const slots = await t.query(api.booking.getAppointments, {
      userId: "owner",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
    });
    expect(slots).toEqual([
      { appointmentDate: "2026-10-01", appointmentTime: "10:00", status: "pending" },
    ]);
    for (const actor of [t, t.withIdentity({ subject: "attacker" })]) {
      await expect(
        actor.query(api.booking.getAllAppointments, { userId: "owner" }),
      ).rejects.toThrow();
      await expect(
        actor.mutation(api.booking.updateBookingAvailability, { userId: "owner", enabled: false }),
      ).rejects.toThrow();
      await expect(
        actor.mutation(api.booking.cancelAppointment, { appointmentId: id }),
      ).rejects.toThrow();
      await expect(
        actor.mutation(api.booking.rescheduleAppointment, { appointmentId: id }),
      ).rejects.toThrow();
    }
    expect((await owner.query(api.booking.getAllAppointments, { userId: "owner" }))[0].email).toBe(
      "customer@example.test",
    );
    await owner.mutation(api.booking.cancelAppointment, { appointmentId: id });
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("cancelled");
  });

  test("settings and referrals require their real actor; commission writes are internal", async () => {
    const t = convexTest(schema, modules);
    const actor = t.withIdentity({ subject: "attacker" });
    await expect(
      actor.mutation(api.payments.updatePaymentSettings, {
        userId: "owner",
        stripeAccountId: "attacker_account",
      }),
    ).rejects.toThrow();
    await expect(
      actor.mutation(api.notifications.updateNotificationSettings, {
        userId: "owner",
        emailNotifications: false,
      }),
    ).rejects.toThrow();
    await expect(
      actor.mutation(api.recommendations.createRecommendation, {
        recommenderUserId: "owner",
        recommendedUserId: "attacker",
        rating: 5,
      }),
    ).rejects.toThrow();
    await expect(
      actor.mutation(api.referrals.createReferral, {
        referrerUserId: "owner",
        referredUserId: "attacker",
        referredFirstName: "Customer",
        referredEmail: "customer@example.test",
      }),
    ).rejects.toThrow();
    await expect(
      actor.mutation(api.verifications.applyForVerification, { userId: "owner", type: "verified" }),
    ).rejects.toThrow();
    await expect(t.mutation(api.files.generateUploadUrl, {})).rejects.toThrow();
    expect(createCommission.isInternal).toBe(true);
    expect(updateCommissionStatus.isInternal).toBe(true);
  });
});
