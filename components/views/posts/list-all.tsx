"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PostWithMeta } from "@/convex/posts";
import { type User } from "@/hooks/user";
import { PostCard } from "./card";

export function PostsList({
  user = undefined,
  currentUserId,
}: {
  user?: User;
  currentUserId?: string;
}) {
  const userPosts = useQuery(
    api.posts.getPosts,
    user?.id ? { userId: user.id } : "skip",
  );
  // Global feed only — profile pages must not also subscribe to getAllPosts.
  const allPosts = useQuery(
    api.posts.getAllPosts,
    user ? "skip" : { currentUserId, limit: 20 },
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
