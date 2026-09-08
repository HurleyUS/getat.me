"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PiCalendarLight,
  PiXLight,
  PiArrowCircleRightLight,
  PiDownloadLight,
} from "react-icons/pi";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import FeatureTitle from "./feature-title";

// Generate .ics file for calendar import
function generateICS(appointment: {
  appointmentDate: string;
  appointmentTime: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
}) {
  const date = new Date(`${appointment.appointmentDate}T${appointment.appointmentTime}`);
  const endDate = new Date(date.getTime() + 30 * 60 * 1000); // 30 minutes later

  const formatDate = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Get At Me//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `DTSTART:${formatDate(date)}`,
    `DTEND:${formatDate(endDate)}`,
    `SUMMARY:Appointment with ${appointment.name}`,
    `DESCRIPTION:${appointment.message || "Appointment"}`,
    `LOCATION:Online`,
    `ORGANIZER;CN=Get At Me:MAILTO:noreply@getat.me`,
    `ATTENDEE;CN=${appointment.name};RSVP=TRUE:MAILTO:${appointment.email}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return icsContent;
}

// Download .ics file
function downloadICS(icsContent: string, filename: string) {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

type Appointment = {
  _id: Id<"appointments">;
  appointmentDate: string;
  appointmentTime: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  status: "pending" | "confirmed" | "cancelled";
};

export function AppointmentsTable() {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const { toast } = useToast();
  const appointments = useQuery(
    api.booking.getAllAppointments,
    isAuthenticated && user?.id ? { userId: user.id } : "skip",
  ) as Appointment[] | undefined;

  // Get user handle for profile URL
  const userProfile = useQuery(
    api.users.getCurrentUserProfile,
    isAuthenticated && user?.id ? { userId: user.id } : "skip",
  );

  const cancelAppointment = useMutation(api.booking.cancelAppointment);
  const rescheduleAppointment = useMutation(api.booking.rescheduleAppointment);
  const [processingId, setProcessingId] = useState<Id<"appointments"> | null>(null);

  const handleAddToCalendar = (appointment: Appointment) => {
    if (!appointments || !Array.isArray(appointments)) return;
    const icsContent = generateICS(appointment);
    const dateStr = appointment.appointmentDate.replace(/-/g, "");
    const filename = `appointment-${dateStr}-${appointment.appointmentTime.replace(":", "")}.ics`;
    downloadICS(icsContent, filename);
    toast({
      title: "Calendar file downloaded",
      description: "Add the appointment to your calendar",
    });
  };

  const handleReschedule = async (appointmentId: Id<"appointments">, appointment: Appointment) => {
    if (!user?.id) return;
    setProcessingId(appointmentId);
    try {
      await rescheduleAppointment({ appointmentId });

      // Send email to booker
      const handle = userProfile?.handle || user.id;
      const profileUrl = `${window.location.origin}/${handle}`;
      const appointmentDateTime = new Date(
        `${appointment.appointmentDate}T${appointment.appointmentTime}`,
      ).toLocaleString();

      const emailHtml = `
        <p>Hi ${appointment.name},</p>
        <p>Your appointment scheduled for ${appointmentDateTime} has been rescheduled.</p>
        <p>Please visit <a href="${profileUrl}">${profileUrl}</a> to select a new time that works for you.</p>
        <p>Thank you!</p>
      `;

      const res = await fetch("/api/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: appointment.email,
          subject: "Appointment Rescheduled - Please Select New Time",
          html: emailHtml,
        }),
      });

      if (!res.ok) throw new Error("Failed to send email");

      toast({
        title: "Appointment rescheduled",
        description: "The booker has been notified to select a new time",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to reschedule appointment",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (appointmentId: Id<"appointments">, appointment: Appointment) => {
    setProcessingId(appointmentId);
    try {
      await cancelAppointment({ appointmentId });

      // Send email to booker
      const appointmentDateTime = new Date(
        `${appointment.appointmentDate}T${appointment.appointmentTime}`,
      ).toLocaleString();

      const emailHtml = `
        <p>Hi ${appointment.name},</p>
        <p>Your appointment scheduled for ${appointmentDateTime} has been cancelled.</p>
        <p>We apologize for any inconvenience. If you'd like to schedule a new appointment, please visit our booking page.</p>
        <p>Thank you!</p>
      `;

      const res = await fetch("/api/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: appointment.email,
          subject: "Appointment Cancelled",
          html: emailHtml,
        }),
      });

      if (!res.ok) throw new Error("Failed to send email");

      toast({
        title: "Appointment cancelled",
        description: "The booker has been notified",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to cancel appointment",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (appointments === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Appointments</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Separate appointments into upcoming and past
  const now = new Date();
  const activeAppointments = appointments
    .filter((apt) => apt.status !== "cancelled")
    .filter((apt) => {
      const aptDate = new Date(`${apt.appointmentDate}T${apt.appointmentTime}`);
      return aptDate >= now;
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.appointmentDate}T${a.appointmentTime}`).getTime();
      const dateB = new Date(`${b.appointmentDate}T${b.appointmentTime}`).getTime();
      return dateA - dateB; // Sort upcoming by date ascending
    });

  const pastAppointments = appointments
    .filter((apt) => apt.status !== "cancelled")
    .filter((apt) => {
      const aptDate = new Date(`${apt.appointmentDate}T${apt.appointmentTime}`);
      return aptDate < now;
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.appointmentDate}T${a.appointmentTime}`).getTime();
      const dateB = new Date(`${b.appointmentDate}T${b.appointmentTime}`).getTime();
      return dateB - dateA; // Sort past by date descending
    });

  const cancelledAppointments = appointments.filter((apt) => apt.status === "cancelled");

  return (
    <Card>
      <CardHeader>
        <FeatureTitle
          Icon={PiCalendarLight}
          title="Appointments"
          description="Manage your scheduled appointments"
        />
      </CardHeader>
      <CardContent>
        {activeAppointments.length === 0 &&
        pastAppointments.length === 0 &&
        cancelledAppointments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No appointments scheduled yet</p>
        ) : (
          <div className="space-y-6">
            {activeAppointments.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Upcoming Appointments</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeAppointments.map((appointment) => {
                      const appointmentDateTime = new Date(
                        `${appointment.appointmentDate}T${appointment.appointmentTime}`,
                      );
                      const isProcessing = processingId === appointment._id;
                      const appointmentId = appointment._id;

                      return (
                        <TableRow key={appointment._id}>
                          <TableCell>
                            <div className="font-medium">
                              {appointmentDateTime.toLocaleDateString()}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {appointment.appointmentTime}
                            </div>
                          </TableCell>
                          <TableCell>{appointment.name}</TableCell>
                          <TableCell>{appointment.email}</TableCell>
                          <TableCell>{appointment.phone || "-"}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {appointment.message || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddToCalendar(appointment)}
                                disabled={isProcessing}
                                title="Add to Calendar"
                              >
                                <PiDownloadLight className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReschedule(appointmentId, appointment)}
                                disabled={isProcessing}
                                title="Reschedule"
                              >
                                <PiArrowCircleRightLight className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancel(appointmentId, appointment)}
                                disabled={isProcessing}
                                title="Cancel"
                              >
                                <PiXLight className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {pastAppointments.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Past Appointments</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pastAppointments.map((appointment) => {
                      const appointmentDateTime = new Date(
                        `${appointment.appointmentDate}T${appointment.appointmentTime}`,
                      );
                      return (
                        <TableRow key={appointment._id} className="opacity-60">
                          <TableCell>
                            <div className="font-medium">
                              {appointmentDateTime.toLocaleDateString()}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {appointment.appointmentTime}
                            </div>
                          </TableCell>
                          <TableCell>{appointment.name}</TableCell>
                          <TableCell>{appointment.email}</TableCell>
                          <TableCell>{appointment.phone || "-"}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {appointment.message || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {cancelledAppointments.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Cancelled Appointments</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cancelledAppointments.map((appointment) => {
                      const appointmentDateTime = new Date(
                        `${appointment.appointmentDate}T${appointment.appointmentTime}`,
                      );
                      return (
                        <TableRow key={appointment._id} className="opacity-50">
                          <TableCell>
                            <div className="font-medium">
                              {appointmentDateTime.toLocaleDateString()}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {appointment.appointmentTime}
                            </div>
                          </TableCell>
                          <TableCell>{appointment.name}</TableCell>
                          <TableCell>{appointment.email}</TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">Cancelled</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
