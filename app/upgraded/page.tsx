"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PiCheckCircleLight, PiSparkleLight } from "react-icons/pi";
import plans from "@/config/plans";

export default function UpgradedPage() {
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const { has } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const userProfile = useQuery(api.users.getCurrentUserProfile, isAuthenticated ? {} : "skip");

  // Convert plans object to array with planKey
  const allPlans = [
    { ...plans.promax, planKey: "promax" as const },
    { ...plans.pro, planKey: "pro" as const },
    { ...plans.premium, planKey: "premium" as const },
  ];

  // Determine current plan based on highest tier
  const currentPlan = allPlans.find(
    (plan) => has?.({ plan: plan.slug }) || has?.({ plan: plan.planKey }),
  );

  // Redirect to profile if user has handle
  useEffect(() => {
    if (currentPlan && userLoaded && user?.id && userProfile?.handle) {
      // Small delay to show thank you message
      const timer = setTimeout(() => {
        router.push(`/${userProfile.handle}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentPlan?.id, userLoaded, user?.id, userProfile?.handle, router]);

  if (!userLoaded || !user?.id) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <section className="border-b border-border/60 bg-muted/10 py-24 pt-32">
        <div className="mx-auto w-full max-w-3xl px-4 text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <PiCheckCircleLight className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            {currentPlan ? "Your plan is active" : "Check your subscription"}
          </h1>
          {currentPlan && (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              <PiSparkleLight className="h-4 w-4" />
              <span>You&rsquo;re now on the {currentPlan.name} plan</span>
            </div>
          )}
          <p className="text-muted-foreground text-lg">
            {currentPlan
              ? "Your plan’s features are ready to use, including during any applicable trial."
              : "A paid plan has not been confirmed for this account. You can review your plan and billing details from your account."}
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto w-full max-w-xl px-4 text-center space-y-6">
          {userProfile?.handle ? (
            <>
              <p className="text-muted-foreground">
                {currentPlan
                  ? "Redirecting you to your profile page..."
                  : "Your profile is available while you review your subscription."}
              </p>
              <Button asChild size="lg">
                <Link href={`/${userProfile.handle}`}>Go to My Profile</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                Set up your profile to start using all the new features!
              </p>
              <Button asChild size="lg">
                <Link href="/onboarding">Set Up Profile</Link>
              </Button>
            </>
          )}
          {!currentPlan && (
            <Button asChild variant="outline">
              <Link href="/account">Review My Account</Link>
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
