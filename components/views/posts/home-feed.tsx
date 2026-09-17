"use client";

import { useUser } from "@clerk/nextjs";
import { PostsList } from "./list-all";

/** Signed-in home feed: current user\'s posts only (skips global getAllPosts SyncWorker). */
export function HomeFeed() {
  const { user } = useUser();
  if (!user?.id) return null;
  return <PostsList user={{ id: user.id }} currentUserId={user.id} />;
}
