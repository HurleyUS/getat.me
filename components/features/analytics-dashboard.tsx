"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  PiChartBarLight,
  PiEyeLight,
  PiCursorClickLight,
  PiCalendarLight,
  PiChatCircleLight,
} from "react-icons/pi";
import FeatureTitle from "./feature-title";

export function AnalyticsDashboard() {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const analytics = useQuery(
    api.analytics.getAnalytics,
    isAuthenticated && user?.id ? { userId: user.id, days: 30 } : "skip",
  );

  if (!user?.id) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <FeatureTitle
          Icon={PiChartBarLight}
          title="Analytics"
          description="View your page performance metrics"
        />
      </CardHeader>
      <CardContent className="space-y-6">
        {analytics === undefined ? (
          <p className="text-center text-muted-foreground py-8">Loading...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <PiEyeLight className="h-4 w-4" />
                  Page Views
                </div>
                <div className="mt-1 text-2xl font-bold">{analytics.pageViews}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <PiCursorClickLight className="h-4 w-4" />
                  Link Clicks
                </div>
                <div className="mt-1 text-2xl font-bold">{analytics.linkClicks}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <PiCalendarLight className="h-4 w-4" />
                  Booking Requests
                </div>
                <div className="mt-1 text-2xl font-bold">{analytics.bookingRequests}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <PiChatCircleLight className="h-4 w-4" />
                  Messages
                </div>
                <div className="mt-1 text-2xl font-bold">{analytics.messages}</div>
              </div>
            </div>

            {analytics.eventsByDay.length > 0 && (
              <div className="space-y-2">
                <div className="font-medium text-sm">Last 7 Days</div>
                <div className="space-y-2">
                  {analytics.eventsByDay.slice(-7).map((day) => (
                    <div key={day.date} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {new Date(day.date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Views:</span> {day.pageViews}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Clicks:</span> {day.linkClicks}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Bookings:</span>{" "}
                          {day.bookingRequests}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Messages:</span> {day.messages}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
