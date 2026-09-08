"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser, useAuth } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useEffect, useState } from "react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { ShareProfile } from "@/components/features/share-profile";
import {
  PiEyeLight,
  PiCursorClickLight,
  PiCalendarCheckLight,
  PiChatCircleLight,
  PiLinkLight,
  PiUserLight,
  PiChartLineUpLight,
  PiArrowUpRightLight,
  PiGearLight,
  PiPlusCircleLight,
  PiSparkleLight,
  PiTrendUpLight,
  PiTrendDownLight,
  PiWarningLight,
  PiShareNetworkLight,
} from "react-icons/pi";

// Mini bar chart component
function MiniChart({ data, color = "bg-primary" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-12">
      {data.map((value, i) => (
        <div
          key={i}
          className={`w-2 rounded-t ${color} opacity-80 transition-all`}
          style={{ height: `${Math.max((value / max) * 100, 4)}%` }}
        />
      ))}
    </div>
  );
}

// Metric card with trend
function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  chartData,
  href,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  trend?: number;
  trendLabel?: string;
  chartData?: number[];
  href?: string;
}) {
  const content = (
    <Card className="group hover:shadow-md transition-all">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Icon className="h-4 w-4" />
              {title}
            </div>
            <div className="text-3xl font-bold tracking-tight">{value.toLocaleString()}</div>
            {trend !== undefined && (
              <div
                className={`flex items-center gap-1 text-xs ${trend >= 0 ? "text-green-600" : "text-red-500"}`}
              >
                {trend >= 0 ? (
                  <PiTrendUpLight className="h-3 w-3" />
                ) : (
                  <PiTrendDownLight className="h-3 w-3" />
                )}
                <span>
                  {trend >= 0 ? "+" : ""}
                  {trend}%
                </span>
                {trendLabel && <span className="text-muted-foreground ml-1">{trendLabel}</span>}
              </div>
            )}
          </div>
          {chartData && <MiniChart data={chartData} />}
        </div>
        {href && (
          <div className="mt-4 flex items-center text-xs text-muted-foreground group-hover:text-primary transition-colors">
            View details <PiArrowUpRightLight className="h-3 w-3 ml-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// Quick action card
function QuickAction({
  title,
  description,
  icon: Icon,
  href,
  variant = "default",
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  variant?: "default" | "primary";
}) {
  return (
    <Link href={href}>
      <Card
        className={`group cursor-pointer transition-all hover:shadow-md ${variant === "primary" ? "border-primary/50 bg-primary/5" : ""}`}
      >
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-xl ${variant === "primary" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium group-hover:text-primary transition-colors">{title}</div>
              <div className="text-sm text-muted-foreground truncate">{description}</div>
            </div>
            <PiArrowUpRightLight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const handle = params.handle as string;
  const { user: currentUser, isLoaded: userLoaded } = useUser();
  const { has } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const [showShare, setShowShare] = useState(false);

  // Queries
  const userByHandle = useQuery(api.users.getUserByHandle, { handle });
  const currentUserProfile = useQuery(
    api.users.getCurrentUserProfile,
    isAuthenticated ? {} : "skip",
  );
  const analytics = useQuery(
    api.analytics.getAnalytics,
    isAuthenticated && currentUser?.id ? { userId: currentUser.id, days: 30 } : "skip",
  );
  const links = useQuery(
    api.links.getDashboardLinksByHandle,
    isAuthenticated && userByHandle?.userId === currentUser?.id ? { handle } : "skip",
  );

  // Check if current user owns this profile
  const isOwner = useMemo(() => {
    return currentUserProfile && userByHandle && currentUserProfile.userId === userByHandle.userId;
  }, [currentUserProfile, userByHandle]);

  // Redirect non-owners
  useEffect(() => {
    if (
      isAuthenticated &&
      userLoaded &&
      currentUser &&
      userByHandle !== undefined &&
      currentUserProfile !== undefined &&
      !isOwner
    ) {
      router.push(`/${handle}`);
    }
  }, [userLoaded, currentUser, userByHandle, isOwner, router, handle]);

  // Loading state
  if (!userLoaded || userByHandle === undefined || analytics === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-pulse text-muted-foreground">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  // Not owner - show nothing while redirecting
  if (!isOwner) {
    return null;
  }

  // Calculate trends (comparing last 7 days to previous 7 days)
  const last7Days = analytics.eventsByDay.slice(-7);
  const prev7Days = analytics.eventsByDay.slice(-14, -7);

  const sumEvents = (
    days: typeof last7Days,
    type: "pageViews" | "linkClicks" | "bookingRequests" | "messages",
  ) => days.reduce((sum, d) => sum + d[type], 0);

  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const viewsTrend = calcTrend(
    sumEvents(last7Days, "pageViews"),
    sumEvents(prev7Days, "pageViews"),
  );
  const clicksTrend = calcTrend(
    sumEvents(last7Days, "linkClicks"),
    sumEvents(prev7Days, "linkClicks"),
  );
  const bookingsTrend = calcTrend(
    sumEvents(last7Days, "bookingRequests"),
    sumEvents(prev7Days, "bookingRequests"),
  );
  const messagesTrend = calcTrend(
    sumEvents(last7Days, "messages"),
    sumEvents(prev7Days, "messages"),
  );

  // Chart data (last 14 days)
  const chartDays = analytics.eventsByDay.slice(-14);
  const viewsChartData = chartDays.map((d) => d.pageViews);
  const clicksChartData = chartDays.map((d) => d.linkClicks);
  const bookingsChartData = chartDays.map((d) => d.bookingRequests);
  const messagesChartData = chartDays.map((d) => d.messages);

  const hasUnlimitedLinks = has?.({ feature: "unlimited_links" }) ?? false;
  const isPro =
    userByHandle?.subscriptionPlan === "pro" || userByHandle?.subscriptionPlan === "promax";
  const linkCount = links?.length ?? 0;
  const linkLimit = hasUnlimitedLinks ? Infinity : 3;
  const nearLinkLimit = !hasUnlimitedLinks && linkCount >= 2;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="border-b bg-background">
        <Container size="boxed" className="py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground">
                Welcome back, @{handle}. Here&apos;s how your page is performing.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => setShowShare(true)}>
                <PiShareNetworkLight className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/${handle}`}>
                  <PiEyeLight className="h-4 w-4 mr-2" />
                  View Profile
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/${handle}/account`}>
                  <PiGearLight className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </Button>
            </div>
          </div>
        </Container>
      </div>

      <Container size="boxed" className="py-8 space-y-8">
        {/* Alerts */}
        {nearLinkLimit && !hasUnlimitedLinks && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                  <PiWarningLight className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-amber-900 dark:text-amber-100">
                    You&apos;re approaching your link limit
                  </div>
                  <div className="text-sm text-amber-700 dark:text-amber-300">
                    Free accounts can have up to 3 links. Upgrade to Pro for unlimited links.
                  </div>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="border-amber-500/50 hover:bg-amber-500/10"
                >
                  <Link href="/pricing">Upgrade</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Metrics */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PiChartLineUpLight className="h-5 w-5 text-muted-foreground" />
            Performance Overview
            <span className="text-sm font-normal text-muted-foreground ml-2">Last 30 days</span>
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Page Views"
              value={analytics.pageViews}
              icon={PiEyeLight}
              trend={viewsTrend}
              trendLabel="vs last week"
              chartData={viewsChartData}
            />
            <MetricCard
              title="Link Clicks"
              value={analytics.linkClicks}
              icon={PiCursorClickLight}
              trend={clicksTrend}
              trendLabel="vs last week"
              chartData={clicksChartData}
            />
            <MetricCard
              title="Bookings"
              value={analytics.bookingRequests}
              icon={PiCalendarCheckLight}
              trend={bookingsTrend}
              trendLabel="vs last week"
              chartData={bookingsChartData}
            />
            <MetricCard
              title="Messages"
              value={analytics.messages}
              icon={PiChatCircleLight}
              trend={messagesTrend}
              trendLabel="vs last week"
              chartData={messagesChartData}
            />
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{linkCount}</div>
                  <div className="text-sm text-muted-foreground">Active Links</div>
                </div>
                <div className="text-muted-foreground">
                  {!hasUnlimitedLinks && <span className="text-xs">/ {linkLimit} max</span>}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold capitalize">
                    {userByHandle?.subscriptionPlan || "Free"}
                  </div>
                  <div className="text-sm text-muted-foreground">Current Plan</div>
                </div>
                {!isPro && (
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/pricing">Upgrade</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold capitalize">
                    {userByHandle?.theme || "Default"}
                  </div>
                  <div className="text-sm text-muted-foreground">Theme</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{analytics.totalEvents}</div>
                  <div className="text-sm text-muted-foreground">Total Events</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PiSparkleLight className="h-5 w-5 text-muted-foreground" />
            Quick Actions
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <QuickAction
              title="Add New Link"
              description="Add a link to your profile"
              icon={PiPlusCircleLight}
              href={`/${handle}#add-link`}
              variant={linkCount < linkLimit ? "primary" : "default"}
            />
            <QuickAction
              title="Edit Profile"
              description="Update your bio and avatar"
              icon={PiUserLight}
              href={`/${handle}`}
            />
            <QuickAction
              title="Manage Links"
              description={`${linkCount} active links`}
              icon={PiLinkLight}
              href={`/${handle}`}
            />
            {isPro && (
              <>
                <QuickAction
                  title="View Bookings"
                  description="Manage your appointments"
                  icon={PiCalendarCheckLight}
                  href={`/${handle}#bookings`}
                />
                <QuickAction
                  title="Messages"
                  description="View conversations"
                  icon={PiChatCircleLight}
                  href={`/${handle}#messages`}
                />
              </>
            )}
            <QuickAction
              title="Account Settings"
              description="Manage your account"
              icon={PiGearLight}
              href={`/${handle}/account`}
            />
          </div>
        </div>

        {/* Daily Breakdown */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Daily Activity</h2>
          <Card>
            <CardContent className="pt-6">
              {analytics.eventsByDay.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <PiChartLineUpLight className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No activity recorded yet.</p>
                  <p className="text-sm mt-1">Share your profile to start tracking visits!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-5 text-xs text-muted-foreground font-medium pb-2 border-b">
                    <div>Date</div>
                    <div className="text-right">Views</div>
                    <div className="text-right">Clicks</div>
                    <div className="text-right">Bookings</div>
                    <div className="text-right">Messages</div>
                  </div>
                  {analytics.eventsByDay
                    .slice(-14)
                    .reverse()
                    .map((day) => (
                      <div
                        key={day.date}
                        className="grid grid-cols-5 text-sm py-2 border-b border-border/50 last:border-0"
                      >
                        <div className="font-medium">
                          {new Date(day.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                        <div className="text-right tabular-nums">{day.pageViews}</div>
                        <div className="text-right tabular-nums">{day.linkClicks}</div>
                        <div className="text-right tabular-nums">{day.bookingRequests}</div>
                        <div className="text-right tabular-nums">{day.messages}</div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Share Modal */}
        {showShare && (
          <ShareProfile
            handle={handle}
            brandColor={(userByHandle as unknown as Record<string, string | undefined>)?.brandColor}
            onClose={() => setShowShare(false)}
          />
        )}

        {/* Pro CTA if not subscribed */}
        {!isPro && (
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">Unlock Pro Features</h3>
                  <p className="text-muted-foreground">
                    Get unlimited links, booking forms, live chat, advanced analytics, and more with
                    a Pro subscription.
                  </p>
                </div>
                <Button size="lg" asChild>
                  <Link href="/pricing">
                    <PiSparkleLight className="h-4 w-4 mr-2" />
                    View Plans
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </Container>
    </div>
  );
}
