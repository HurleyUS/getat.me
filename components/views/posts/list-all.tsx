"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PostWithMeta } from "@/convex/posts";
import { PostCard } from "./card";

/** Hard cap for live SyncWorker feeds — prevents full-table egress refill. */
const FEED_LIMIT = 20;

export function PostsList({
  user = undefined,
  currentUserId,
}: {
  user?: { id: string } | null;
  currentUserId?: string;
}) {
  // CRITICAL: never subscribe to both feeds. Prior bug always ran getAllPosts
  // even on profile pages, so every profile viewer paid for the global feed.
  const userPosts = useQuery(
    api.posts.getPosts,
    user?.id ? { userId: user.id, limit: FEED_LIMIT } : "skip",
  );
  const allPosts = useQuery(
    api.posts.getAllPosts,
    user ? "skip" : { currentUserId, limit: FEED_LIMIT },
  );

  const posts = user ? userPosts : allPosts;

  return (
    <>
      {posts &&
        posts.length > 0 &&
        posts.map((post) => {
          return (
            <div key={post._id}>
              <PostCard post={post as PostWithMeta} />
            </div>
          );
        })}
    </>
  );
}
