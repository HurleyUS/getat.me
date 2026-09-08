import { requireOwner } from "../lib/convex-auth";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getRecommendations = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("recommendations")
      .withIndex("by_recommendedUserId", (q) => q.eq("recommendedUserId", args.userId))
      .collect();
  },
});

export const getUserRecommendation = query({
  args: {
    recommendedUserId: v.string(),
    recommenderUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("recommendations")
      .withIndex("by_recommended_recommender", (q) =>
        q
          .eq("recommendedUserId", args.recommendedUserId)
          .eq("recommenderUserId", args.recommenderUserId),
      )
      .first();
  },
});

export const createRecommendation = mutation({
  args: {
    recommendedUserId: v.string(),
    recommenderUserId: v.string(),
    rating: v.number(),
    review: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.recommenderUserId);
    // Check if recommendation already exists
    const existing = await ctx.db
      .query("recommendations")
      .withIndex("by_recommended_recommender", (q) =>
        q
          .eq("recommendedUserId", args.recommendedUserId)
          .eq("recommenderUserId", args.recommenderUserId),
      )
      .first();

    if (existing) {
      // Update existing recommendation
      return await ctx.db.patch(existing._id, {
        rating: args.rating,
        review: args.review,
      });
    }

    // Create new recommendation
    return await ctx.db.insert("recommendations", {
      recommendedUserId: args.recommendedUserId,
      recommenderUserId: args.recommenderUserId,
      rating: args.rating,
      review: args.review,
      createdAt: Date.now(),
    });
  },
});

export const getRecommendationStats = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const recommendations = await ctx.db
      .query("recommendations")
      .withIndex("by_recommendedUserId", (q) => q.eq("recommendedUserId", args.userId))
      .collect();

    if (recommendations.length === 0) {
      return { count: 0, averageRating: 0 };
    }

    const totalRating = recommendations.reduce((sum, rec) => sum + rec.rating, 0);
    const averageRating = totalRating / recommendations.length;

    return {
      count: recommendations.length,
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
    };
  },
});
