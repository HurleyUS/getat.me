import { requireOwner } from "../lib/convex-auth";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getAnalytics = query({
  args: {
    userId: v.string(),
    days: v.optional(v.number()), // Number of days to look back, default 30
  },
  returns: v.object({
    pageViews: v.number(),
    linkClicks: v.number(),
    bookingRequests: v.number(),
    messages: v.number(),
    totalEvents: v.number(),
    eventsByDay: v.array(
      v.object({
        date: v.string(),
        pageViews: v.number(),
        linkClicks: v.number(),
        bookingRequests: v.number(),
        messages: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const days = args.days ?? 30;
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

    const events = await ctx.db
      .query("analytics")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", args.userId).gte("createdAt", startTime),
      )
      .collect();

    const stats = {
      pageViews: 0,
      linkClicks: 0,
      bookingRequests: 0,
      messages: 0,
      totalEvents: events.length,
      eventsByDay: [] as Array<{
        date: string;
        pageViews: number;
        linkClicks: number;
        bookingRequests: number;
        messages: number;
      }>,
    };

    // Group events by day
    const eventsByDayMap = new Map<
      string,
      {
        pageViews: number;
        linkClicks: number;
        bookingRequests: number;
        messages: number;
      }
    >();

    for (const event of events) {
      const date = new Date(event.createdAt).toISOString().split("T")[0];
      if (!eventsByDayMap.has(date)) {
        eventsByDayMap.set(date, {
          pageViews: 0,
          linkClicks: 0,
          bookingRequests: 0,
          messages: 0,
        });
      }

      const dayStats = eventsByDayMap.get(date)!;

      if (event.eventType === "page_view") {
        stats.pageViews++;
        dayStats.pageViews++;
      } else if (event.eventType === "link_click") {
        stats.linkClicks++;
        dayStats.linkClicks++;
      } else if (event.eventType === "booking_request") {
        stats.bookingRequests++;
        dayStats.bookingRequests++;
      } else if (event.eventType === "message") {
        stats.messages++;
        dayStats.messages++;
      }
    }

    // Convert map to array and sort by date
    stats.eventsByDay = Array.from(eventsByDayMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return stats;
  },
});

export const trackEvent = mutation({
  args: {
    userId: v.string(),
    eventType: v.string(),
    eventData: v.optional(
      v.object({
        linkId: v.optional(v.string()),
        referrer: v.optional(v.string()),
        userAgent: v.optional(v.string()),
      }),
    ),
  },
  returns: v.id("analytics"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("analytics", {
      userId: args.userId,
      eventType: args.eventType,
      eventData: args.eventData,
      createdAt: Date.now(),
    });
  },
});
