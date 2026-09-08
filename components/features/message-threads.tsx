"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, usePaginatedQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import FeatureTitle from "./feature-title";
import { PiChatCircleLight, PiPaperPlaneTiltLight } from "react-icons/pi";

export function MessageThreads() {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoadingOlderRef = useRef(false);

  const conversations = useQuery(
    api.messages.getConversations,
    isAuthenticated && user?.id ? { userId: user.id } : "skip",
  );

  const {
    results: messages,
    loadMore,
    status: paginationStatus,
  } = usePaginatedQuery(
    api.messages.getMessages,
    isAuthenticated && user?.id && selectedUserId
      ? { userId1: user.id, userId2: selectedUserId }
      : "skip",
    { initialNumItems: 50 },
  );

  const sendMessage = useMutation(api.messages.sendMessage);
  const markAsRead = useMutation(api.messages.markMessagesAsRead);

  // Auto-select first conversation
  useEffect(() => {
    if (conversations && conversations.length > 0 && !selectedUserId) {
      setSelectedUserId(conversations[0].otherUserId);
    }
  }, [conversations, selectedUserId]);

  // Scroll to bottom when messages change (skip when loading older messages)
  useEffect(() => {
    if (isLoadingOlderRef.current) {
      isLoadingOlderRef.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (isAuthenticated && selectedUserId && user?.id) {
      markAsRead({
        userId1: user.id,
        userId2: selectedUserId,
        readerUserId: user.id,
      }).catch(() => {
        // Ignore errors
      });
    }
  }, [selectedUserId, user?.id, markAsRead]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !selectedUserId || !message.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage({
        senderUserId: user.id,
        receiverUserId: selectedUserId,
        content: message.trim(),
      });
      setMessage("");
    } catch {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!user?.id) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <FeatureTitle Icon={PiChatCircleLight} title="Messages" description="Your conversations" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-12 gap-4 h-[600px]">
          {/* Conversations Sidebar */}
          <div className="col-span-4 border-r border-border pr-4">
            <ScrollArea className="h-full">
              <div className="space-y-2">
                {conversations && conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No conversations yet
                  </p>
                ) : (
                  conversations?.map((conv) => (
                    <ConversationItem
                      key={conv.otherUserId}
                      otherUserId={conv.otherUserId}
                      lastMessage={conv.lastMessage}
                      unreadCount={conv.unreadCount}
                      isSelected={selectedUserId === conv.otherUserId}
                      onClick={() => setSelectedUserId(conv.otherUserId)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Messages View */}
          <div className="col-span-8 flex flex-col">
            {selectedUserId ? (
              <>
                <ScrollArea className="flex-1 mb-4">
                  <div className="space-y-3 pr-4">
                    {paginationStatus === "CanLoadMore" && (
                      <button
                        type="button"
                        onClick={() => {
                          isLoadingOlderRef.current = true;
                          loadMore(50);
                        }}
                        className="w-full py-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Load older messages
                      </button>
                    )}
                    {messages && messages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <p>No messages yet. Start the conversation!</p>
                      </div>
                    ) : (
                      messages?.map((msg) => {
                        const isOwn = msg.senderUserId === user.id;
                        return (
                          <div
                            key={msg._id}
                            className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg p-3 ${
                                isOwn
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground"
                              }`}
                            >
                              <p className="text-sm">{msg.content}</p>
                              <p
                                className={`text-xs mt-1 ${
                                  isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                                }`}
                              >
                                {new Date(msg.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <form onSubmit={handleSend} className="border-t pt-4">
                  <div className="flex gap-2">
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Type a message..."
                      disabled={isSending}
                    />
                    <Button type="submit" disabled={isSending || !message.trim()} size="icon">
                      <PiPaperPlaneTiltLight className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <p>Select a conversation to start messaging</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConversationItem({
  otherUserId,
  lastMessage,
  unreadCount,
  isSelected,
  onClick,
}: {
  otherUserId: string;
  lastMessage: { content: string; createdAt: number };
  unreadCount: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const otherUser = useQuery(api.users.getUserByID, { userId: otherUserId });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        isSelected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card hover:bg-muted border-border"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0">
          {otherUser?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={otherUser.avatarUrl}
              alt={otherUser.handle || ""}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-semibold">
              {(otherUser?.handle || otherUser?.first || "?")[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="font-medium truncate">
              @{otherUser?.handle || otherUser?.first || "User"}
            </p>
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">
                {unreadCount}
              </span>
            )}
          </div>
          <p
            className={`text-sm truncate ${
              isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
            }`}
          >
            {lastMessage.content}
          </p>
          <p
            className={`text-xs ${
              isSelected ? "text-primary-foreground/50" : "text-muted-foreground"
            }`}
          >
            {new Date(lastMessage.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </button>
  );
}
