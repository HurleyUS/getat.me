"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { getHandleError } from "@/lib/handles";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { trackProfileCreated, trackFormSubmit } from "@/lib/analytics";
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
import {
  PiCheckCircleLight,
  PiXCircleLight,
  PiSpinnerLight,
  PiLinkLight,
  PiSparkleLight,
  PiRocketLaunchLight,
} from "react-icons/pi";

// Debounce hook for handle availability checking
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce handle for availability check
  const debouncedHandle = useDebounce(handle, 300);

  const userProfile = useQuery(api.users.getCurrentUserProfile, isAuthenticated ? {} : "skip");

  // Check handle availability
  const handleAvailability = useQuery(
    api.users.getUserByHandle,
    !getHandleError(debouncedHandle) ? { handle: debouncedHandle } : "skip",
  );

  const setHandleMutation = useMutation(api.users.setHandle);

  // Derive availability state
  const handleError = getHandleError(handle);
  const isHandleValid = !handleError;
  const isCheckingAvailability =
    isHandleValid && (debouncedHandle !== handle || handleAvailability === undefined);
  const isAvailable = handleAvailability === null && !isCheckingAvailability && isHandleValid;
  const isTaken =
    isHandleValid &&
    handleAvailability !== null &&
    handleAvailability !== undefined &&
    !isCheckingAvailability;

  // Redirect if user already has a handle
  useEffect(() => {
    if (userLoaded && user?.id && userProfile?.handle) {
      router.replace(`/${userProfile.handle}`);
    }
  }, [userLoaded, user?.id, userProfile?.handle, router]);

  // Show loading state while checking user
  if (!userLoaded || !user?.id || !isAuthenticated || userProfile === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <PiSpinnerLight className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = getHandleError(handle.trim().toLowerCase());
    if (validationError) {
      setError(validationError);
      return;
    }

    if (isTaken) {
      setError("This handle is already taken");
      return;
    }

    setIsSubmitting(true);

    try {
      await setHandleMutation({
        handle: handle.trim().toLowerCase(),
      });
      // Track profile creation
      trackFormSubmit("onboarding");
      trackProfileCreated(handle.trim().toLowerCase());
      // Redirect to profile page
      router.push(`/${handle.trim().toLowerCase()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set handle");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-radial-[at_50%_0%] from-primary/20 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 bg-linear-to-tl from-secondary/15 to-transparent blur-3xl" />
      </div>

      {/* Progress indicator */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
            1
          </div>
          <span className="text-sm font-medium">Choose Handle</span>
        </div>
        <div className="h-px w-8 bg-border" />
        <div className="flex items-center gap-2 opacity-40">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
            2
          </div>
          <span className="text-sm">Customize</span>
        </div>
        <div className="h-px w-8 bg-border opacity-40" />
        <div className="flex items-center gap-2 opacity-40">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
            3
          </div>
          <span className="text-sm">Launch</span>
        </div>
      </div>

      <Card className="w-full max-w-md border-2">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <PiSparkleLight className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Claim Your Handle</CardTitle>
          <CardDescription className="text-base">
            Your handle is your unique identity on GetAt.Me
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 pt-4">
            {/* Live URL Preview */}
            <div className="rounded-xl bg-muted/50 border border-border/50 p-4 text-center">
              <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                <PiLinkLight className="h-3 w-3" />
                Your profile URL
              </div>
              <div className="font-mono text-lg">
                getat.me/
                <span className={handle ? "text-primary font-bold" : "text-muted-foreground"}>
                  {handle || "yourhandle"}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="handle" className="text-base">
                Handle
              </Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  @
                </div>
                <Input
                  id="handle"
                  value={handle}
                  onChange={(e) => {
                    setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
                    setError("");
                  }}
                  placeholder="yourhandle"
                  disabled={isSubmitting}
                  className="pl-8 pr-10 font-mono text-lg h-12"
                  autoFocus
                  autoComplete="off"
                  maxLength={32}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {handle.length >= 3 && (
                    <>
                      {isCheckingAvailability && (
                        <PiSpinnerLight className="h-5 w-5 animate-spin text-muted-foreground" />
                      )}
                      {isAvailable && <PiCheckCircleLight className="h-5 w-5 text-green-500" />}
                      {isTaken && <PiXCircleLight className="h-5 w-5 text-red-500" />}
                    </>
                  )}
                </div>
              </div>

              {/* Status messages */}
              {handle.length > 0 && handleError && (
                <p className="text-sm text-muted-foreground">{handleError}</p>
              )}
              {isAvailable && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <PiCheckCircleLight className="h-4 w-4" />
                  This handle is available!
                </p>
              )}
              {isTaken && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <PiXCircleLight className="h-4 w-4" />
                  This handle is already taken
                </p>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, underscores, and hyphens only
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={isSubmitting || !isAvailable}
            >
              {isSubmitting ? (
                <>
                  <PiSpinnerLight className="h-5 w-5 animate-spin mr-2" />
                  Creating your page...
                </>
              ) : (
                <>
                  <PiRocketLaunchLight className="h-5 w-5 mr-2" />
                  Claim @{handle || "yourhandle"}
                </>
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              You can always change your handle later
            </p>
          </CardFooter>
        </form>
      </Card>

      {/* Features preview */}
      <div className="mt-12 max-w-md w-full">
        <h3 className="text-sm font-medium text-muted-foreground text-center mb-4">
          What you&apos;ll get
        </h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary">∞</div>
            <div className="text-xs text-muted-foreground">Profile views</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary">3</div>
            <div className="text-xs text-muted-foreground">Free links</div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-primary">9</div>
            <div className="text-xs text-muted-foreground">Theme options</div>
          </div>
        </div>
      </div>
    </div>
  );
}
