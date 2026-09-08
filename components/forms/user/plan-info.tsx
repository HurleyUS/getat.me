"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckoutButton } from "@clerk/clerk-react/experimental";
import { SignedIn, useAuth } from "@clerk/nextjs";
import plans from "@/config/plans";
import { useState } from "react";
import { BillingSubscriptionPlanPeriod } from "@clerk/types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function PlanInfo() {
  const { has } = useAuth();
  const [planPeriod, setPlanPeriod] = useState<BillingSubscriptionPlanPeriod>("annual");

  // Convert plans object to array with planKey and ordered by priority (highest first)
  const allPlans = [
    { ...plans.promax, planKey: "promax" as const },
    { ...plans.pro, planKey: "pro" as const },
    { ...plans.premium, planKey: "premium" as const },
  ];

  // Helper function to find plan by name
  const getPlanByName = (name: string) => allPlans.find((p) => p.name === name);

  // Determine current plan based on highest tier
  // Since plans are ordered by priority (highest first), find first matching plan
  const currentPlan = allPlans.find(
    (plan) => has?.({ plan: plan.slug }) || has?.({ plan: plan.planKey }),
  ) || {
    name: "FREE",
    price: { annual: "$0/mo", month: "$0/mo" },
  };

  // Filter plans to show only upgrades based on current plan
  const getUpgradePlans = () => {
    if (currentPlan.name === "ProMax") {
      return []; // Don't show anything if they have ProMax
    } else if (currentPlan.name === "Pro") {
      return [getPlanByName("ProMax")].filter((p): p is NonNullable<typeof p> => Boolean(p));
    } else if (currentPlan.name === "Premium") {
      return [getPlanByName("Pro"), getPlanByName("ProMax")].filter(
        (p): p is NonNullable<typeof p> => Boolean(p),
      );
    } else {
      // FREE users see all upgrades
      return allPlans;
    }
  };

  const upgradePlans = getUpgradePlans();

  return (
    <div className="space-y-6">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="pb-3 px-0">
          <CardTitle className="text-base font-semibold">Current Plan:</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <p className="text-sm font-medium">
            {currentPlan.name}{" "}
            <span className="text-muted-foreground font-normal">
              {currentPlan.price[planPeriod]}
            </span>
          </p>
        </CardContent>
      </Card>

      {upgradePlans.length > 0 && (
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="pb-3 px-0">
            <CardTitle className="text-base font-semibold">Upgrade Plan:</CardTitle>
          </CardHeader>
          <CardContent className="px-0 space-y-2">
            <Label htmlFor="plan-period">
              <Switch
                id="plan-period"
                checked={planPeriod === "annual"}
                onCheckedChange={(checked) => setPlanPeriod(checked ? "annual" : "month")}
              />
              <span className="text-sm font-medium">
                {planPeriod === "annual" ? "Annually" : "Monthly"}
              </span>
            </Label>
            {upgradePlans.map((plan) => (
              <SignedIn key={plan.planKey}>
                <CheckoutButton planId={plan.id} planPeriod={planPeriod}>
                  <Button
                    variant="outline"
                    className="w-full justify-between bg-accent hover:bg-accent-hover border-accent text-accent-foreground"
                  >
                    <strong>{plan.name}</strong>
                    <small>{plan.price[planPeriod]}</small>
                  </Button>
                </CheckoutButton>
              </SignedIn>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
