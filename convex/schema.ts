import { v } from "convex/values";
import { z } from "zod";
import { defineSchema, defineTable } from "convex/server";

export default defineSchema({
  clerkBillingSnapshots: defineTable({
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
  }).index("by_userId", ["userId"]),
  users: defineTable({
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
  })
    .searchIndex("search_by_handle", { searchField: "handle" })
    .index("by_userId", ["userId"])
    .index("by_handle", ["handle"])
    .index("by_email", ["email"])
    .index("by_phone", ["phone"])
    .index("by_subscriptionPlan", ["subscriptionPlan"]),
  subscriptions: defineTable({
    userId: v.string(),
    subscriptionId: v.string(),
    priceId: v.string(),
    expires: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_subscriptionId", ["subscriptionId"])
    .index("by_priceId", ["priceId"]),
  links: defineTable({
    userId: v.string(),
    anchor: v.string(),
    href: v.string(),
    weight: v.optional(v.number()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    sectionId: v.optional(v.id("sections")),
    publishAt: v.optional(v.number()),
    unpublishAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),
  sections: defineTable({
    userId: v.string(),
    name: v.string(),
    weight: v.number(),
    icon: v.optional(v.string()),
    description: v.optional(v.string()),
  }).index("by_userId", ["userId"]),
  bookingAvailability: defineTable({
    userId: v.string(),
    enabled: v.boolean(),
    defaultStartTime: v.string(), // "09:00" format
    defaultEndTime: v.string(), // "17:00" format
    monday: v.boolean(),
    tuesday: v.boolean(),
    wednesday: v.boolean(),
    thursday: v.boolean(),
    friday: v.boolean(),
    saturday: v.boolean(),
    sunday: v.boolean(),
  }).index("by_userId", ["userId"]),
  appointments: defineTable({
    userId: v.string(), // The user being booked
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    message: v.optional(v.string()),
    appointmentDate: v.string(), // ISO date string
    appointmentTime: v.string(), // "09:00" format
    status: v.union(v.literal("pending"), v.literal("confirmed"), v.literal("cancelled")),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "appointmentDate"]),
  recommendations: defineTable({
    recommendedUserId: v.string(), // User being recommended
    recommenderUserId: v.string(), // User making the recommendation
    rating: v.number(), // 1-5 stars
    review: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_recommendedUserId", ["recommendedUserId"])
    .index("by_recommenderUserId", ["recommenderUserId"])
    .index("by_recommended_recommender", ["recommendedUserId", "recommenderUserId"]),
  referrals: defineTable({
    referrerUserId: v.string(), // User sending the referral
    referredUserId: v.string(), // User being referred
    referredFirstName: v.string(),
    referredEmail: v.string(),
    referredPhone: v.optional(v.string()),
    message: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_referrerUserId", ["referrerUserId"])
    .index("by_referredUserId", ["referredUserId"]),
  messages: defineTable({
    conversationId: v.string(), // Composite: userId1_userId2 (sorted)
    senderUserId: v.string(),
    receiverUserId: v.string(),
    content: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_conversationId", ["conversationId"])
    .index("by_receiverUserId", ["receiverUserId"])
    .index("by_senderUserId", ["senderUserId"]),
  posts: defineTable({
    userId: v.string(),
    content: v.string(),
    media: v.optional(v.array(v.id("_storage"))),
    parentId: v.optional(v.id("posts")), // For replies/threads
    repostOfId: v.optional(v.id("posts")), // For reposts (quote or pure repost)
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_parentId", ["parentId"])
    .index("by_repostOfId", ["repostOfId"])
    .index("by_repostOfId_userId", ["repostOfId", "userId"]), // Composite for checking user reposts
  likes: defineTable({
    userId: v.string(), // User who liked
    postId: v.id("posts"), // Post that was liked
    createdAt: v.number(),
  })
    .index("by_postId", ["postId"])
    .index("by_userId", ["userId"])
    .index("by_userId_postId", ["userId", "postId"]),
  paymentSettings: defineTable({
    userId: v.string(),
    enabled: v.boolean(),
    currency: v.string(), // "USD", "EUR", etc.
    defaultPrice: v.number(), // Default price in cents
    stripeAccountId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
  commissions: defineTable({
    referrerUserId: v.string(), // User who earned the commission
    referralId: v.id("referrals"), // Reference to the referral
    amount: v.number(), // Commission amount in cents
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("cancelled")),
    paidAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_referrerUserId", ["referrerUserId"])
    .index("by_referralId", ["referralId"]),
  verifications: defineTable({
    userId: v.string(),
    type: v.union(v.literal("verified"), v.literal("vetted")),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    applicationData: v.optional(
      v.object({
        documentUrl: v.optional(v.id("_storage")),
        additionalInfo: v.optional(v.string()),
      }),
    ),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_type", ["userId", "type"]),
  analytics: defineTable({
    userId: v.string(), // The page owner
    eventType: v.string(), // "page_view", "link_click", "booking_request", etc.
    eventData: v.optional(
      v.object({
        linkId: v.optional(v.string()),
        referrer: v.optional(v.string()),
        userAgent: v.optional(v.string()),
      }),
    ),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_eventType", ["userId", "eventType"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),
  notificationSettings: defineTable({
    userId: v.string(),
    emailNotifications: v.boolean(),
    bookingNotifications: v.boolean(),
    messageNotifications: v.boolean(),
    referralNotifications: v.boolean(),
    reviewNotifications: v.boolean(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
});

export const userObject = z.object({
  userId: z.string(),
  handle: z.string().optional(),
  first: z.string().optional(),
  last: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  avatar: z.string().optional(),
  cover: z.string().optional(),
  bio: z.string().optional(),
  theme: z.string().optional(),
  subscriptionPlan: z.string().optional(),
});

export type User = z.infer<typeof userObject>;

export const subscriptionObject = z.object({
  userId: z.string(),
  subscriptionId: z.string(),
  expires: z.number(),
  priceId: z.string(),
});

export type Subscription = z.infer<typeof subscriptionObject>;

export const linkObject = z.object({
  userId: z.string(),
  anchor: z.string(),
  href: z.string(),
  weight: z.number().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export type Link = z.infer<typeof linkObject>;
