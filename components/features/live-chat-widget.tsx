"use client";

import { useUser } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import { usePaginatedQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, X, Send, Minimize2, Maximize2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface LiveChatWidgetProps {
  profileUserId: string;
  profileHandle: string;
}

export function LiveChatWidget({ profileUserId, profileHandle }: LiveChatWidgetProps) {
  const { user, isSignedIn } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoadingOlderRef = useRef(false);

  // Get messages for this conversation
  const {
    results: messages,
    loadMore,
    status: paginationStatus,
  } = usePaginatedQuery(
    api.messages.getMessages,
    isAuthenticated && user?.id && isSignedIn
      ? { userId1: user.id, userId2: profileUserId }
      : "skip",
    { initialNumItems: 50 },
  );

  const sendMessage = useMutation(api.messages.sendMessage);
  const markAsRead = useMutation(api.messages.markMessagesAsRead);

  // Scroll to bottom when messages change (skip when loading older messages)
  useEffect(() => {
    if (isLoadingOlderRef.current) {
      isLoadingOlderRef.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read when chat is opened
  useEffect(() => {
    if (isAuthenticated && isOpen && isSignedIn && user?.id) {
      markAsRead({
        userId1: user.id,
        userId2: profileUserId,
        readerUserId: user.id,
      }).catch(() => {
        // Ignore errors
      });
    }
  }, [isAuthenticated, isOpen, isSignedIn, user?.id, profileUserId, markAsRead]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !message.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage({
        senderUserId: user.id,
        receiverUserId: profileUserId,
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

  if (user?.id === profileUserId) {
    return null; // Don't show chat to yourself
  }

  if (!isSignedIn) {
    // Show button but prompt to sign in when clicked
    return (
      <SignInButton mode="modal">
        <Button
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          size="icon"
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </SignInButton>
    );
  }

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
          size="icon"
          aria-label="Open chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-96 h-[500px] shadow-2xl z-50 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <h3 className="font-semibold">Chat with @{profileHandle}</h3>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-8 w-8 p-0"
                aria-label={isMinimized ? "Expand chat" : "Minimize chat"}
              >
                {isMinimized ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Minimize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 p-0"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {!isMinimized && (
            <>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                {paginationStatus === "CanLoadMore" && (
                  <button
                    type="button"
                    onClick={() => {
                      isLoadingOlderRef.current = true;
                      loadMore(50);
                    }}
                    className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
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
                    const isOwn = msg.senderUserId === user?.id;
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
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </CardContent>

              <form onSubmit={handleSend} className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    disabled={isSending}
                  />
                  <Button type="submit" disabled={isSending || !message.trim()} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </>
          )}
        </Card>
      )}
    </>
  );
}
