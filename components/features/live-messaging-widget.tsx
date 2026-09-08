"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, usePaginatedQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PiChatCircle, PiPaperPlaneTilt } from "react-icons/pi";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function LiveMessagingWidget() {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const { toast } = useToast();
  const conversations = useQuery(
    api.messages.getConversations,
    isAuthenticated && user?.id ? { userId: user.id } : "skip",
  );
  const sendMessage = useMutation(api.messages.sendMessage);
  const markAsRead = useMutation(api.messages.markMessagesAsRead);

  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  const {
    results: messages,
    loadMore,
    status: paginationStatus,
  } = usePaginatedQuery(
    api.messages.getMessages,
    isAuthenticated && user?.id && selectedConversation
      ? {
          userId1: user.id,
          userId2: selectedConversation,
        }
      : "skip",
    { initialNumItems: 50 },
  );

  const handleSendMessage = async () => {
    if (!user?.id || !selectedConversation || !messageContent.trim()) return;

    setIsSending(true);
    try {
      await sendMessage({
        senderUserId: user.id,
        receiverUserId: selectedConversation,
        content: messageContent.trim(),
      });
      setMessageContent("");
      toast({
        title: "Message sent",
        description: "Your message has been sent",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectConversation = async (otherUserId: string) => {
    setSelectedConversation(otherUserId);
    if (user?.id) {
      try {
        await markAsRead({
          userId1: user.id,
          userId2: otherUserId,
          readerUserId: user.id,
        });
      } catch (error) {
        console.error("Failed to mark messages as read:", error);
        toast({
          title: "Warning",
          description: "Failed to update read status",
          variant: "destructive",
        });
      }
    }
  };

  if (!user?.id) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <PiChatCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle>Live Messaging</CardTitle>
            <CardDescription>Chat with visitors in real-time</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {conversations === undefined ? (
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        ) : conversations.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            You {"don't"} have any conversations yet
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 space-y-2">
              <div className="font-medium text-sm">Conversations</div>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {conversations.map((conv) => (
                  <Button
                    key={conv.otherUserId}
                    variant={selectedConversation === conv.otherUserId ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => handleSelectConversation(conv.otherUserId)}
                  >
                    <div className="flex-1 text-left">
                      <div className="font-medium">{conv.otherUserDisplayName}</div>
                      {conv.unreadCount > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {conv.unreadCount} unread
                        </div>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {selectedConversation && (
              <div className="md:col-span-2 space-y-4">
                <div className="border rounded-lg p-4 h-96 overflow-y-auto space-y-2">
                  {paginationStatus === "CanLoadMore" && (
                    <button
                      type="button"
                      onClick={() => loadMore(50)}
                      className="w-full py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Load older messages
                    </button>
                  )}
                  {messages === undefined ? (
                    <p className="text-center text-muted-foreground py-8">Loading messages...</p>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No messages yet. Start the conversation!
                    </p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg._id}
                        className={`flex ${
                          msg.senderUserId === user.id ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-2 ${
                            msg.senderUserId === user.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    placeholder="Type a message..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={isSending || !messageContent.trim()}
                  >
                    <PiPaperPlaneTilt className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
