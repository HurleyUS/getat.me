"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { getHandleError } from "@/lib/handles";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetHandleModal() {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  const { isSignedIn, user, isLoaded: userLoaded } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const userProfile = useQuery(api.users.getCurrentUserProfile, isAuthenticated ? {} : "skip");
  const setHandleMutation = useMutation(api.users.setHandle);

  // Don't show modal if user is not signed in or not loaded
  if (
    !userLoaded ||
    !isSignedIn ||
    !user?.id ||
    !isAuthenticated ||
    userProfile === undefined ||
    userProfile?.handle
  )
    return <></>;

  // Show modal only when we know for sure the user doesn't have a handle
  // userProfile === null means user doesn't exist in Convex yet
  // userProfile?.handle is falsy means user exists but has no handle
  const shouldShowModal = userLoaded && isSignedIn && isAuthenticated && !userProfile?.handle;

  if (!shouldShowModal) return <></>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsChecking(true);

    const validationError = getHandleError(handle.trim().toLowerCase());
    if (validationError) {
      setError(validationError);
      setIsChecking(false);
      return;
    }

    try {
      await setHandleMutation({
        handle: handle.trim().toLowerCase(),
      });
      // Clear form - modal will disappear when query updates
      setHandle("");
      setIsChecking(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set handle");
      setIsChecking(false);
    }
  };

  return shouldShowModal ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle>Choose Your Handle</CardTitle>
          <CardDescription>
            Your handle will be used in your profile URL (getat.me/yourhandle)
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="handle">Handle</Label>
              <Input
                id="handle"
                value={handle}
                onChange={(e) => {
                  setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
                  setError("");
                }}
                placeholder="yourhandle"
                disabled={isChecking}
                className="font-mono"
                maxLength={32}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">
                Must be unique and contain only lowercase letters, numbers, underscores, and hyphens
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isChecking}>
              {isChecking ? "Checking..." : "Continue"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  ) : (
    <></>
  );
}
