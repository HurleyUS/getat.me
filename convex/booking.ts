import { requireOwner } from "../lib/convex-auth";
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

export const getBookingAvailability = query({
  args: {
    userId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("bookingAvailability"),
      _creationTime: v.number(),
      userId: v.string(),
      enabled: v.boolean(),
      defaultStartTime: v.string(),
      defaultEndTime: v.string(),
      monday: v.boolean(),
      tuesday: v.boolean(),
      wednesday: v.boolean(),
      thursday: v.boolean(),
      friday: v.boolean(),
      saturday: v.boolean(),
      sunday: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bookingAvailability")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    return existing;
  },
});

export const updateBookingAvailability = mutation({
  args: {
    userId: v.string(),
    enabled: v.optional(v.boolean()),
    defaultStartTime: v.optional(v.string()),
    defaultEndTime: v.optional(v.string()),
    monday: v.optional(v.boolean()),
    tuesday: v.optional(v.boolean()),
    wednesday: v.optional(v.boolean()),
    thursday: v.optional(v.boolean()),
    friday: v.optional(v.boolean()),
    saturday: v.optional(v.boolean()),
    sunday: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const existing = await ctx.db
      .query("bookingAvailability")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    // If creating new, use defaults: M-F 9-5
    const data = {
      userId: args.userId,
      enabled: args.enabled ?? existing?.enabled ?? true,
      defaultStartTime: args.defaultStartTime ?? existing?.defaultStartTime ?? "09:00",
      defaultEndTime: args.defaultEndTime ?? existing?.defaultEndTime ?? "17:00",
      monday: args.monday ?? existing?.monday ?? true,
      tuesday: args.tuesday ?? existing?.tuesday ?? true,
      wednesday: args.wednesday ?? existing?.wednesday ?? true,
      thursday: args.thursday ?? existing?.thursday ?? true,
      friday: args.friday ?? existing?.friday ?? true,
      saturday: args.saturday ?? existing?.saturday ?? false,
      sunday: args.sunday ?? existing?.sunday ?? false,
    };

    if (existing) {
      // Only update fields that were provided
      const updateData: {
        userId: string;
        enabled?: boolean;
        defaultStartTime?: string;
        defaultEndTime?: string;
        monday?: boolean;
        tuesday?: boolean;
        wednesday?: boolean;
        thursday?: boolean;
        friday?: boolean;
        saturday?: boolean;
        sunday?: boolean;
      } = { userId: args.userId };

      if (args.enabled !== undefined) updateData.enabled = args.enabled;
      if (args.defaultStartTime !== undefined) updateData.defaultStartTime = args.defaultStartTime;
      if (args.defaultEndTime !== undefined) updateData.defaultEndTime = args.defaultEndTime;
      if (args.monday !== undefined) updateData.monday = args.monday;
      if (args.tuesday !== undefined) updateData.tuesday = args.tuesday;
      if (args.wednesday !== undefined) updateData.wednesday = args.wednesday;
      if (args.thursday !== undefined) updateData.thursday = args.thursday;
      if (args.friday !== undefined) updateData.friday = args.friday;
      if (args.saturday !== undefined) updateData.saturday = args.saturday;
      if (args.sunday !== undefined) updateData.sunday = args.sunday;

      return await ctx.db.patch(existing._id, updateData);
    } else {
      // Create new with defaults
      return await ctx.db.insert("bookingAvailability", data);
    }
  },
});

export const getAppointments = query({
  args: {
    userId: v.string(),
    startDate: v.string(), // ISO date string
    endDate: v.string(), // ISO date string
  },
  handler: async (ctx, args) => {
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(
          q.gte(q.field("appointmentDate"), args.startDate),
          q.lte(q.field("appointmentDate"), args.endDate),
        ),
      )
      .collect();
    // Public availability must not disclose customer names or contact details.
    return appointments.map(({ appointmentDate, appointmentTime, status }) => ({
      appointmentDate,
      appointmentTime,
      status,
    }));
  },
});

export const getAllAppointments = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Sort by date and time (most recent first)
    return appointments.sort((a, b) => {
      const dateA = new Date(`${a.appointmentDate}T${a.appointmentTime}`).getTime();
      const dateB = new Date(`${b.appointmentDate}T${b.appointmentTime}`).getTime();
      return dateB - dateA;
    });
  },
});

export const createAppointment = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    message: v.optional(v.string()),
    appointmentDate: v.string(),
    appointmentTime: v.string(),
  },
  handler: async (ctx, args) => {
    const availability = await ctx.db
      .query("bookingAvailability")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!availability?.enabled) throw new Error("This profile is not accepting bookings");
    // Input validation
    const name = args.name.trim();
    if (name.length < 2 || name.length > 100) {
      throw new Error("Name must be between 2 and 100 characters");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      throw new Error("Invalid email format");
    }

    if (args.phone !== undefined) {
      const phoneRegex = /^\+?[\d\s\-().]{7,20}$/;
      if (!phoneRegex.test(args.phone)) {
        throw new Error("Invalid phone number format");
      }
    }

    if (args.message !== undefined && args.message.length > 1000) {
      throw new Error("Message must be 1000 characters or less");
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(args.appointmentDate) || isNaN(Date.parse(args.appointmentDate))) {
      throw new Error("Invalid date format. Use YYYY-MM-DD");
    }

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(args.appointmentTime)) {
      throw new Error("Invalid time format. Use HH:mm (24-hour)");
    }

    // Check if this time slot is already booked
    const existing = await ctx.db
      .query("appointments")
      .withIndex("by_userId_date", (q) =>
        q.eq("userId", args.userId).eq("appointmentDate", args.appointmentDate),
      )
      .filter((q) => q.eq(q.field("appointmentTime"), args.appointmentTime))
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .first();

    if (existing) {
      throw new Error("This time slot is already booked");
    }

    return await ctx.db.insert("appointments", {
      userId: args.userId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      message: args.message,
      appointmentDate: args.appointmentDate,
      appointmentTime: args.appointmentTime,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const cancelAppointment = mutation({
  args: {
    appointmentId: v.id("appointments"),
  },
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) {
      throw new Error("Appointment not found");
    }
    await requireOwner(ctx, appointment.userId);

    await ctx.db.patch(args.appointmentId, { status: "cancelled" });
    return appointment;
  },
});

export const rescheduleAppointment = mutation({
  args: {
    appointmentId: v.id("appointments"),
  },
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) {
      throw new Error("Appointment not found");
    }
    await requireOwner(ctx, appointment.userId);

    // Mark as cancelled (which frees up the slot)
    await ctx.db.patch(args.appointmentId, { status: "cancelled" });
    return appointment;
  },
});

// Internal mutation to auto-initialize booking availability
export const initializeBookingAvailability = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bookingAvailability")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (!existing) {
      return await ctx.db.insert("bookingAvailability", {
        userId: args.userId,
        enabled: true,
        defaultStartTime: "09:00",
        defaultEndTime: "17:00",
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      });
    }

    return existing._id;
  },
});
