import { requireOwner } from "../lib/convex-auth";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

// Helper to create conversation ID (sorted user IDs)
function getConversationId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join("_");
}

// Helper to get display name from user data
function getUserDisplayName(
  user: { handle?: string; first?: string; last?: string } | null,
  userId: string,
): string {
  if (!user) {
    // Fallback: partially obfuscated value
    return `User...${userId.slice(-4)}`;
  }

  if (user.handle) {
    return user.handle;
  }

  if (user.first && user.last) {
    return `${user.first} ${user.last}`;
  }

  if (user.first) {
    return user.first;
  }

  if (user.last) {
    return user.last;
  }

  // Fallback: partially obfuscated value
  return `User...${userId.slice(-4)}`;
}

export const getConversations = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    // Get all messages where user is sender or receiver
    const sentMessages = await ctx.db
      .query("messages")
      .withIndex("by_senderUserId", (q) => q.eq("senderUserId", args.userId))
      .order("desc")
      .take(100); // limit to 100 most recent per direction

    const receivedMessages = await ctx.db
      .query("messages")
      .withIndex("by_receiverUserId", (q) => q.eq("receiverUserId", args.userId))
      .order("desc")
      .take(100); // limit to 100 most recent per direction

    // Group by conversation ID
    const conversations = new Map<
      string,
      {
        otherUserId: string;
        lastMessage: (typeof sentMessages)[0] | (typeof receivedMessages)[0];
        unreadCount: number;
      }
    >();

    sentMessages.forEach((msg) => {
      const otherUserId = msg.receiverUserId;
      const convId = getConversationId(args.userId, otherUserId);
      const existing = conversations.get(convId);
      if (!existing || msg.createdAt > existing.lastMessage.createdAt) {
        conversations.set(convId, {
          otherUserId,
          lastMessage: msg,
          unreadCount: 0,
        });
      }
    });

    receivedMessages.forEach((msg) => {
      const otherUserId = msg.senderUserId;
      const convId = getConversationId(args.userId, otherUserId);
      const existing = conversations.get(convId);
      const unreadCount = msg.read ? 0 : 1;
      if (!existing || msg.createdAt > existing.lastMessage.createdAt) {
        conversations.set(convId, {
          otherUserId,
          lastMessage: msg,
          unreadCount,
        });
      } else if (!msg.read) {
        existing.unreadCount += unreadCount;
      }
    });

    // Fetch user data for all other users
    const conversationArray = Array.from(conversations.values());
    const uniqueOtherUserIds = [...new Set(conversationArray.map((c) => c.otherUserId))];

    const userMap = new Map<string, { handle?: string; first?: string; last?: string } | null>();
    for (const otherUserId of uniqueOtherUserIds) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_userId", (q) => q.eq("userId", otherUserId))
        .first();
      userMap.set(otherUserId, user);
    }

    // Add display names to conversations
    return conversationArray
      .map((conv) => ({
        ...conv,
        otherUserDisplayName: getUserDisplayName(
          userMap.get(conv.otherUserId) || null,
          conv.otherUserId,
        ),
      }))
      .sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt);
  },
});

export const getMessages = query({
  args: {
    userId1: v.string(),
    userId2: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const actor = await requireOwner(ctx);
    if (actor !== args.userId1 && actor !== args.userId2)
      throw new Error("Not a conversation participant");
    const conversationId = getConversationId(args.userId1, args.userId2);
    return await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", conversationId))
      .order("asc")
      .paginate(args.paginationOpts);
  },
});

export const sendMessage = mutation({
  args: {
    senderUserId: v.string(),
    receiverUserId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.senderUserId);
    const conversationId = getConversationId(args.senderUserId, args.receiverUserId);

    return await ctx.db.insert("messages", {
      conversationId,
      senderUserId: args.senderUserId,
      receiverUserId: args.receiverUserId,
      content: args.content,
      read: false,
      createdAt: Date.now(),
    });
  },
});

export const markMessagesAsRead = mutation({
  args: {
    userId1: v.string(),
    userId2: v.string(),
    readerUserId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.readerUserId);
    if (args.readerUserId !== args.userId1 && args.readerUserId !== args.userId2)
      throw new Error("Not a conversation participant");
    const conversationId = getConversationId(args.userId1, args.userId2);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", conversationId))
      .filter((q) =>
        q.and(q.eq(q.field("receiverUserId"), args.readerUserId), q.eq(q.field("read"), false)),
      )
      .collect();

    for (const message of messages) {
      await ctx.db.patch(message._id, { read: true });
    }
  },
});
