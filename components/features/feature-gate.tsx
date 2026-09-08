"use client";

import { SignedIn, useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckoutButton } from "@clerk/clerk-react/experimental";
import Link from "next/link";
import { PiLock } from "react-icons/pi";
import plans from "@/config/plans";

interface FeatureGateProps {
  title: string;
  description: string;
  requiredPlan?: "premium" | "pro" | "promax";
  icon?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}

export function FeatureGate({
  title,
  description,
  requiredPlan,
  icon: Icon,
  children,
}: FeatureGateProps) {
  const { has } = useAuth();

  const permittedPlans = {
    premium: [plans.premium.slug, "premium", "pro", "promax"],
    pro: ["pro", "promax"],
    promax: ["promax"],
  };
  const hasAccess =
    !requiredPlan ||
    process.env.NODE_ENV === "development" ||
    permittedPlans[requiredPlan].some((plan) => has?.({ plan }));

  if (hasAccess && children) {
    return <>{children}</>;
  }

  // Determine upgrade plan
  const upgradePlan =
    requiredPlan === "premium"
      ? plans.premium
      : requiredPlan === "pro"
        ? plans.pro
        : requiredPlan === "promax"
          ? plans.promax
          : null;

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {title}
              <PiLock className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {Icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This feature is available on the{" "}
            {requiredPlan === "premium" ? "Premium" : requiredPlan === "pro" ? "Pro" : "ProMax"}{" "}
            plan.
          </p>
          {upgradePlan && (
            <div className="flex gap-2">
              <SignedIn>
                <CheckoutButton planId={upgradePlan.id}>
                  <Button>Upgrade to {upgradePlan.name}</Button>
                </CheckoutButton>
              </SignedIn>
              <Button asChild variant="outline">
                <Link href="/pricing">View Plans</Link>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
