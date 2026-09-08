"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PiBellLight } from "react-icons/pi";
import { useState, useEffect } from "react";
import FeatureTitle from "./feature-title";

export function NotificationsWidget() {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const { toast } = useToast();
  const settings = useQuery(
    api.notifications.getNotificationSettings,
    isAuthenticated && user?.id ? { userId: user.id } : "skip",
  );
  const updateSettings = useMutation(api.notifications.updateNotificationSettings);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [bookingNotifications, setBookingNotifications] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [referralNotifications, setReferralNotifications] = useState(true);
  const [reviewNotifications, setReviewNotifications] = useState(true);

  useEffect(() => {
    if (settings) {
      setEmailNotifications(settings.emailNotifications);
      setBookingNotifications(settings.bookingNotifications);
      setMessageNotifications(settings.messageNotifications);
      setReferralNotifications(settings.referralNotifications);
      setReviewNotifications(settings.reviewNotifications);
    }
  }, [settings]);

  const handleToggle = async (
    setting: string,
    value: boolean,
    setter: (value: boolean) => void,
  ) => {
    if (!user?.id) return;
    setter(value);
    try {
      await updateSettings({
        userId: user.id,
        [setting]: value,
      });
      toast({
        title: "Settings updated",
        description: `Notification preferences have been updated`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to update notification settings",
        variant: "destructive",
      });
    }
  };

  if (settings === undefined) {
    return (
      <Card>
        <CardHeader>
          <FeatureTitle
            Icon={PiBellLight}
            title="Notifications"
            description="Manage your notification preferences"
          />
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <FeatureTitle
          Icon={PiBellLight}
          title="Notifications"
          description="Manage your notification preferences"
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="email-notifications">Email Notifications</Label>
            <p className="text-sm text-muted-foreground">Receive notifications via email</p>
          </div>
          <Switch
            id="email-notifications"
            checked={emailNotifications}
            onCheckedChange={(checked) =>
              handleToggle("emailNotifications", checked, setEmailNotifications)
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="booking-notifications">Booking Notifications</Label>
            <p className="text-sm text-muted-foreground">Get notified about new booking requests</p>
          </div>
          <Switch
            id="booking-notifications"
            checked={bookingNotifications}
            onCheckedChange={(checked) =>
              handleToggle("bookingNotifications", checked, setBookingNotifications)
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="message-notifications">Message Notifications</Label>
            <p className="text-sm text-muted-foreground">Get notified about new messages</p>
          </div>
          <Switch
            id="message-notifications"
            checked={messageNotifications}
            onCheckedChange={(checked) =>
              handleToggle("messageNotifications", checked, setMessageNotifications)
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="referral-notifications">Referral Notifications</Label>
            <p className="text-sm text-muted-foreground">Get notified about new referrals</p>
          </div>
          <Switch
            id="referral-notifications"
            checked={referralNotifications}
            onCheckedChange={(checked) =>
              handleToggle("referralNotifications", checked, setReferralNotifications)
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="review-notifications">Review Notifications</Label>
            <p className="text-sm text-muted-foreground">Get notified about new reviews</p>
          </div>
          <Switch
            id="review-notifications"
            checked={reviewNotifications}
            onCheckedChange={(checked) =>
              handleToggle("reviewNotifications", checked, setReviewNotifications)
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
