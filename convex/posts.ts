import { requireOwner } from "../lib/convex-auth";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export type Post = Doc<"posts">;
export type Like = Doc<"likes">;

export type PostWithMeta = Post & {
  handle?: string;
  likeCount: number;
  replyCount: number;
  repostCount: number;
  isLikedByUser: boolean;
  isRepostedByUser: boolean;
  repostOf?: Post | null;
};

// ============ POST QUERIES ============

export const getPosts = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("parentId"), undefined))
      .order("desc")
      .take(limit);
    return posts.map((post) => ({
      ...post,
      likeCount: post.likeCount ?? 0,
      replyCount: post.replyCount ?? 0,
      repostCount: post.repostCount ?? 0,
    }));
  },
});

export const getAllPosts = query({
  args: {
    currentUserId: v.optional(v.string()),
    // Hard cap — unbounded collect() was the egress blow-up on quiet-elephant-218.
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    // Top-level posts only (parentId undefined), newest first, bounded.
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_parentId", (q) => q.eq("parentId", undefined))
      .order("desc")
      .take(limit);

    const enrichedPosts: PostWithMeta[] = await Promise.all(
      posts.map(async (post) => {
        const [userLike, userRepost, repostOf] = await Promise.all([
          args.currentUserId
            ? ctx.db
                .query("likes")
                .withIndex("by_userId_postId", (q) =>
                  q.eq("userId", args.currentUserId!).eq("postId", post._id),
                )
                .first()
            : null,
          args.currentUserId
            ? ctx.db
                .query("posts")
                .withIndex("by_repostOfId_userId", (q) =>
                  q.eq("repostOfId", post._id).eq("userId", args.currentUserId!),
                )
                .first()
            : null,
          post.repostOfId ? ctx.db.get(post.repostOfId) : null,
        ]);

        return {
          ...post,
          likeCount: post.likeCount ?? 0,
          replyCount: post.replyCount ?? 0,
          repostCount: post.repostCount ?? 0,
          isLikedByUser: !!userLike,
          isRepostedByUser: !!userRepost,
          repostOf,
        };
      }),
    );

    return enrichedPosts;
  },
});

export const getPost = query({
  args: {
    postId: v.id("posts"),
    currentUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) return null;

    const [likeCount, replyCount, repostCount, userLike, userRepost, repostOf] = await Promise.all([
      ctx.db
        .query("likes")
        .withIndex("by_postId", (q) => q.eq("postId", post._id))
        .collect()
        .then((likes) => likes.length),
      ctx.db
        .query("posts")
        .withIndex("by_parentId", (q) => q.eq("parentId", post._id))
        .collect()
        .then((replies) => replies.length),
      ctx.db
        .query("posts")
        .withIndex("by_repostOfId", (q) => q.eq("repostOfId", post._id))
        .collect()
        .then((reposts) => reposts.length),
      args.currentUserId
        ? ctx.db
            .query("likes")
            .withIndex("by_userId_postId", (q) =>
              q.eq("userId", args.currentUserId!).eq("postId", post._id),
            )
            .first()
        : null,
      args.currentUserId
        ? ctx.db
            .query("posts")
            .withIndex("by_repostOfId_userId", (q) =>
              q.eq("repostOfId", post._id).eq("userId", args.currentUserId!),
            )
            .first()
        : null,
      post.repostOfId ? ctx.db.get(post.repostOfId) : null,
    ]);

    return {
      ...post,
      likeCount,
      replyCount,
      repostCount,
      isLikedByUser: !!userLike,
      isRepostedByUser: !!userRepost,
      repostOf,
    } as PostWithMeta;
  },
});

export const getReplies = query({
  args: {
    postId: v.id("posts"),
    currentUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const replies = await ctx.db
      .query("posts")
      .withIndex("by_parentId", (q) => q.eq("parentId", args.postId))
      .order("asc") // Oldest first for threads
      .collect();

    // Enrich replies with metadata
    const enrichedReplies: PostWithMeta[] = await Promise.all(
      replies.map(async (reply) => {
        const [likeCount, replyCount, repostCount, userLike, userRepost] = await Promise.all([
          ctx.db
            .query("likes")
            .withIndex("by_postId", (q) => q.eq("postId", reply._id))
            .collect()
            .then((likes) => likes.length),
          ctx.db
            .query("posts")
            .withIndex("by_parentId", (q) => q.eq("parentId", reply._id))
            .collect()
            .then((r) => r.length),
          ctx.db
            .query("posts")
            .withIndex("by_repostOfId", (q) => q.eq("repostOfId", reply._id))
            .collect()
            .then((r) => r.length),
          args.currentUserId
            ? ctx.db
                .query("likes")
                .withIndex("by_userId_postId", (q) =>
                  q.eq("userId", args.currentUserId!).eq("postId", reply._id),
                )
                .first()
            : null,
          args.currentUserId
            ? ctx.db
                .query("posts")
                .withIndex("by_repostOfId_userId", (q) =>
                  q.eq("repostOfId", reply._id).eq("userId", args.currentUserId!),
                )
                .first()
            : null,
        ]);

        return {
          ...reply,
          likeCount,
          replyCount,
          repostCount,
          isLikedByUser: !!userLike,
          isRepostedByUser: !!userRepost,
          repostOf: null,
        };
      }),
    );

    return enrichedReplies;
  },
});

// ============ POST MUTATIONS ============

export const createPost = mutation({
  args: {
    userId: v.string(),
    content: v.string(),
    media: v.optional(v.array(v.id("_storage"))),
    parentId: v.optional(v.id("posts")),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent) {
        throw new Error("Parent post not found");
      }
      const postId = await ctx.db.insert("posts", {
        userId: args.userId,
        content: args.content,
        media: args.media,
        parentId: args.parentId,
        createdAt: Date.now(),
        likeCount: 0,
        replyCount: 0,
        repostCount: 0,
      });
      await ctx.db.patch(args.parentId, {
        replyCount: (parent.replyCount ?? 0) + 1,
      });
      return postId;
    }

    return await ctx.db.insert("posts", {
      userId: args.userId,
      content: args.content,
      media: args.media,
      createdAt: Date.now(),
      likeCount: 0,
      replyCount: 0,
      repostCount: 0,
    });
  },
});

export const updatePost = mutation({
  args: {
    postId: v.id("posts"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    await requireOwner(ctx, post.userId);
    await ctx.db.patch(args.postId, { content: args.content });
    return await ctx.db.get(args.postId);
  },
});

export const deletePost = mutation({
  args: {
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    await requireOwner(ctx, post.userId);
    // Recursively collect all posts to delete (replies, reposts, and their children)
    const postsToDelete: Id<"posts">[] = [];
    const queue: Id<"posts">[] = [args.postId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      postsToDelete.push(currentId);

      // Get all replies to this post
      const replies = await ctx.db
        .query("posts")
        .withIndex("by_parentId", (q) => q.eq("parentId", currentId))
        .collect();
      for (const reply of replies) {
        queue.push(reply._id);
      }

      // Get all reposts of this post
      const reposts = await ctx.db
        .query("posts")
        .withIndex("by_repostOfId", (q) => q.eq("repostOfId", currentId))
        .collect();
      for (const repost of reposts) {
        queue.push(repost._id);
      }
    }

    // Delete all likes on all affected posts
    for (const postId of postsToDelete) {
      const likes = await ctx.db
        .query("likes")
        .withIndex("by_postId", (q) => q.eq("postId", postId))
        .collect();
      for (const like of likes) {
        await ctx.db.delete(like._id);
      }
    }

    // If this was a reply, keep parent.replyCount in sync.
    if (post.parentId) {
      const parent = await ctx.db.get(post.parentId);
      if (parent) {
        await ctx.db.patch(post.parentId, {
          replyCount: Math.max((parent.replyCount ?? 0) - 1, 0),
        });
      }
    }

    // Delete all affected posts
    for (const postId of postsToDelete) {
      await ctx.db.delete(postId);
    }
  },
});

// ============ LIKE MUTATIONS ============

export const likePost = mutation({
  args: {
    userId: v.string(),
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    // Validate post exists
    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    // Check if already liked
    const existingLike = await ctx.db
      .query("likes")
      .withIndex("by_userId_postId", (q) => q.eq("userId", args.userId).eq("postId", args.postId))
      .first();

    if (existingLike) {
      return existingLike._id; // Already liked
    }

    return await ctx.db.insert("likes", {
      userId: args.userId,
      postId: args.postId,
      createdAt: Date.now(),
    });
  },
});

export const unlikePost = mutation({
  args: {
    userId: v.string(),
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const existingLike = await ctx.db
      .query("likes")
      .withIndex("by_userId_postId", (q) => q.eq("userId", args.userId).eq("postId", args.postId))
      .first();

    if (existingLike) {
      await ctx.db.delete(existingLike._id);
    }
  },
});

export const toggleLike = mutation({
  args: {
    userId: v.string(),
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const existingLike = await ctx.db
      .query("likes")
      .withIndex("by_userId_postId", (q) => q.eq("userId", args.userId).eq("postId", args.postId))
      .first();

    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    if (existingLike) {
      await ctx.db.delete(existingLike._id);
      await ctx.db.patch(args.postId, {
        likeCount: Math.max((post.likeCount ?? 0) - 1, 0),
      });
      return { liked: false };
    } else {
      await ctx.db.insert("likes", {
        userId: args.userId,
        postId: args.postId,
        createdAt: Date.now(),
      });
      await ctx.db.patch(args.postId, {
        likeCount: (post.likeCount ?? 0) + 1,
      });
      return { liked: true };
    }
  },
});

// ============ REPOST MUTATIONS ============

export const repost = mutation({
  args: {
    userId: v.string(),
    postId: v.id("posts"),
    content: v.optional(v.string()), // Optional quote text
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    // Validate the post being reposted exists
    const originalPost = await ctx.db.get(args.postId);
    if (!originalPost) {
      throw new Error("Post not found");
    }

    // Check if already reposted (pure repost, not quote)
    if (!args.content) {
      const existingRepost = await ctx.db
        .query("posts")
        .withIndex("by_repostOfId_userId", (q) =>
          q.eq("repostOfId", args.postId).eq("userId", args.userId),
        )
        .filter((q) => q.eq(q.field("content"), ""))
        .first();

      if (existingRepost) {
        return existingRepost._id; // Already reposted
      }
    }

    const repostId = await ctx.db.insert("posts", {
      userId: args.userId,
      content: args.content || "",
      repostOfId: args.postId,
      createdAt: Date.now(),
      likeCount: 0,
      replyCount: 0,
      repostCount: 0,
    });
    // Pure reposts count toward the original; quote-posts also reference it.
    await ctx.db.patch(args.postId, {
      repostCount: (originalPost.repostCount ?? 0) + 1,
    });
    return repostId;
  },
});

export const undoRepost = mutation({
  args: {
    userId: v.string(),
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    // Find the user's pure repost (no quote content)
    const existingRepost = await ctx.db
      .query("posts")
      .withIndex("by_repostOfId_userId", (q) =>
        q.eq("repostOfId", args.postId).eq("userId", args.userId),
      )
      .filter((q) => q.eq(q.field("content"), ""))
      .first();

    if (existingRepost) {
      await ctx.db.delete(existingRepost._id);
      const original = await ctx.db.get(args.postId);
      if (original) {
        await ctx.db.patch(args.postId, {
          repostCount: Math.max((original.repostCount ?? 0) - 1, 0),
        });
      }
    }
  },
});

// ============ LIKE QUERIES ============

export const getPostLikes = query({
  args: {
    postId: v.id("posts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("likes")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .collect();
  },
});

export const getUserLikes = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("likes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// ============ EGRESS FIX HELPERS ============

/** One-shot after unpause: recompute denormalized counts from source tables. */
export const recomputePostCounts = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("posts")
      .paginate({ numItems: 50, cursor: args.cursor ?? null });

    for (const post of page.page) {
      const [likes, replies, reposts] = await Promise.all([
        ctx.db
          .query("likes")
          .withIndex("by_postId", (q) => q.eq("postId", post._id))
          .collect(),
        ctx.db
          .query("posts")
          .withIndex("by_parentId", (q) => q.eq("parentId", post._id))
          .collect(),
        ctx.db
          .query("posts")
          .withIndex("by_repostOfId", (q) => q.eq("repostOfId", post._id))
          .collect(),
      ]);
      await ctx.db.patch(post._id, {
        likeCount: likes.length,
        replyCount: replies.length,
        repostCount: reposts.length,
      });
    }

    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processed: page.page.length,
    };
  },
});
