"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser as useCurrentUser, useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Id } from "@/convex/_generated/dataModel";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Card, CardContent, CardHeader, CardFooter, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Textarea } from "../../ui/textarea";
import {
  PiTrashLight,
  PiHeartLight,
  PiHeartFill,
  PiChatCircleLight,
  PiChatCircleFill,
  PiArrowsClockwiseLight,
  PiArrowsClockwiseFill,
  PiArrowBendDownRightLight,
} from "react-icons/pi";
import { PostWithMeta } from "@/convex/posts";
import Handle from "../../profile/public/handle";
import { type User } from "@/hooks/user";

interface PostCardProps {
  post: PostWithMeta;
  onReplyCreated?: () => void;
  isReply?: boolean;
  depth?: number;
}

export function PostCard({ post, onReplyCreated, isReply = false, depth = 0 }: PostCardProps) {
  const router = useRouter();
  const auth = useCurrentUser();
  const { has } = useAuth();
  const { toast } = useToast();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const deletePost = useMutation(api.posts.deletePost);
  const toggleLike = useMutation(api.posts.toggleLike);
  const createPost = useMutation(api.posts.createPost);
  const repost = useMutation(api.posts.repost);
  const undoRepost = useMutation(api.posts.undoRepost);

  // Fetch replies when expanded
  const replies = useQuery(
    api.posts.getReplies,
    showReplies ? { postId: post._id, currentUserId: auth?.user?.id } : "skip",
  );

  // Slim author lookup — avoid useUser() which fans out getUserByID + 2
  // verification SyncWorker subscriptions per card (egress multiplier).
  const postUser = useQuery(api.users.getUserByID, { userId: post.userId });
  const repostOriginalUser = useQuery(
    api.users.getUserByID,
    post.repostOf?.userId ? { userId: post.repostOf.userId } : "skip",
  );

  // For reposts, determine if we should show the original content
  const isRepost = !!post.repostOfId && !!post.repostOf;
  const displayContent = isRepost && !post.content ? post.repostOf?.content : post.content;

  const isSignedIn = !!auth?.user?.id;
  // Compare against auth.user.id directly — avoids an extra useUser call per card
  const isMyPost = postUser?.userId === (auth?.user?.id ?? "");
  // ProMax users can reply and repost (dev mode bypasses)
  const canReplyRepost =
    process.env.NODE_ENV === "development" || (has?.({ plan: "promax" }) ?? false);

  const handleDelete = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      await deletePost({ postId: postId as Id<"posts"> });
      toast({
        title: "Post deleted",
        description: "Your post has been removed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive",
      });
      console.error(error);
    }
  };

  const handleLike = async () => {
    if (!isSignedIn || !auth?.user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in to like posts.",
        action: (
          <ToastAction altText="Sign in" onClick={() => router.push("/login")}>
            Sign in
          </ToastAction>
        ),
      });
      return;
    }

    try {
      await toggleLike({
        userId: auth.user.id,
        postId: post._id,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to like post",
        variant: "destructive",
      });
      console.error(error);
    }
  };

  const handleReply = async () => {
    if (!isSignedIn || !auth?.user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in to reply.",
        action: (
          <ToastAction altText="Sign in" onClick={() => router.push("/login")}>
            Sign in
          </ToastAction>
        ),
      });
      return;
    }

    if (!canReplyRepost) {
      toast({
        title: "ProMax required",
        description: "Upgrade to ProMax to reply to posts.",
        action: (
          <ToastAction altText="View pricing" onClick={() => router.push("/pricing")}>
            View pricing
          </ToastAction>
        ),
      });
      return;
    }

    setShowReplyForm(!showReplyForm);
  };

  const submitReply = async () => {
    if (!replyContent.trim() || !auth?.user?.id) return;

    setIsSubmitting(true);
    try {
      await createPost({
        userId: auth.user.id,
        content: replyContent.trim(),
        parentId: post._id,
      });
      setReplyContent("");
      setShowReplyForm(false);
      setShowReplies(true); // Auto-expand replies after posting
      onReplyCreated?.();
      toast({
        title: "Reply posted",
        description: "Your reply has been added.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to post reply",
        variant: "destructive",
      });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRepost = async () => {
    if (!isSignedIn || !auth?.user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in to repost.",
        action: (
          <ToastAction altText="Sign in" onClick={() => router.push("/login")}>
            Sign in
          </ToastAction>
        ),
      });
      return;
    }

    if (!canReplyRepost) {
      toast({
        title: "ProMax required",
        description: "Upgrade to ProMax to repost.",
        action: (
          <ToastAction altText="View pricing" onClick={() => router.push("/pricing")}>
            View pricing
          </ToastAction>
        ),
      });
      return;
    }

    try {
      if (post.isRepostedByUser) {
        await undoRepost({
          userId: auth.user.id,
          postId: post._id,
        });
        toast({
          title: "Repost removed",
        });
      } else {
        await repost({
          userId: auth.user.id,
          postId: post._id,
        });
        toast({
          title: "Reposted!",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to repost",
        variant: "destructive",
      });
      console.error(error);
    }
  };

  const handleToggleReplies = () => {
    setShowReplies(!showReplies);
  };

  return (
    <Card className={isReply ? "border-l-2 border-l-muted ml-4" : ""}>
      <CardHeader>
        <CardTitle>
          {isRepost && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
              <PiArrowsClockwiseLight className="h-3 w-3" />
              <span>
                <Handle user={postUser as User} inline /> reposted
              </span>
            </div>
          )}
          <Handle user={(isRepost ? repostOriginalUser : postUser) as User} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Quote text for quote reposts */}
        {isRepost && post.content && (
          <div className="prose prose-sm max-w-none mb-3 pb-3 border-b">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
              {post.content}
            </ReactMarkdown>
          </div>
        )}
        {/* Main content (or original post content for pure reposts) */}
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {displayContent}
          </ReactMarkdown>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            {/* Like button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className="flex items-center gap-1 text-muted-foreground hover:text-red-500"
            >
              {post.isLikedByUser ? (
                <PiHeartFill className="h-5 w-5 text-red-500" />
              ) : (
                <PiHeartLight className="h-5 w-5" />
              )}
              {post.likeCount > 0 && <span>{post.likeCount}</span>}
            </Button>

            {/* Reply button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReply}
              className={`flex items-center gap-1 text-muted-foreground hover:text-blue-500 ${
                showReplyForm ? "text-blue-500" : ""
              }`}
            >
              {showReplyForm ? (
                <PiChatCircleFill className="h-5 w-5 text-blue-500" />
              ) : (
                <PiChatCircleLight className="h-5 w-5" />
              )}
              {post.replyCount > 0 && <span>{post.replyCount}</span>}
            </Button>

            {/* Repost button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRepost}
              className={`flex items-center gap-1 text-muted-foreground hover:text-green-500 ${
                post.isRepostedByUser ? "text-green-500" : ""
              }`}
            >
              {post.isRepostedByUser ? (
                <PiArrowsClockwiseFill className="h-5 w-5 text-green-500" />
              ) : (
                <PiArrowsClockwiseLight className="h-5 w-5" />
              )}
              {post.repostCount > 0 && <span>{post.repostCount}</span>}
            </Button>
          </div>

          {/* Delete button - only for owner */}
          {isMyPost && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(post._id)}
              className="text-muted-foreground hover:text-destructive"
            >
              <PiTrashLight className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Reply form */}
        {showReplyForm && (
          <div className="w-full space-y-2">
            <Textarea
              placeholder="Write your reply..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyContent("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={submitReply}
                disabled={!replyContent.trim() || isSubmitting}
              >
                {isSubmitting ? "Posting..." : "Reply"}
              </Button>
            </div>
          </div>
        )}

        {/* Thread toggle - show if there are replies */}
        {post.replyCount > 0 && depth < 3 && (
          <div className="w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleReplies}
              className="text-muted-foreground hover:text-foreground w-full justify-start"
            >
              <PiArrowBendDownRightLight className="h-4 w-4 mr-2" />
              {showReplies ? "Hide" : "Show"} {post.replyCount}{" "}
              {post.replyCount === 1 ? "reply" : "replies"}
            </Button>
          </div>
        )}

        {/* Replies list */}
        {showReplies && replies && (
          <div className="w-full space-y-3 mt-2">
            {replies.map((reply) => (
              <PostCard
                key={reply._id}
                post={reply}
                isReply
                depth={depth + 1}
                onReplyCreated={() => {
                  // Replies will auto-refresh via Convex reactivity
                }}
              />
            ))}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
