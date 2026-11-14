"use server";

import {
  createBooking,
  getBooking,
  listBookings,
  listSlots,
} from "@/lib/bookings";
import type { AvailableSlot, Booking } from "@/lib/types";

type PatientBookingLookup = Pick<
  Booking,
  "id" | "slot_id" | "status" | "created_at"
>;

type PatientBookingPage = {
  bookings: PatientBookingLookup[];
  next_cursor: string | null;
};

export async function refreshPatientSlots(): Promise<
  | { ok: true; slots: AvailableSlot[] }
  | { ok: false; error: string }
> {
  try {
    return { ok: true, slots: await listSlots() };
  } catch {
    return { ok: false, error: "Availability is temporarily unavailable." };
  }
}

export async function submitPatientBooking(value: unknown) {
  try {
    return await createBooking(value);
  } catch {
    return {
      ok: false as const,
      status: 500 as const,
      error: "The booking service is unavailable. Please try again.",
    };
  }
}

export async function lookupPatientBooking(value: unknown): Promise<
  | { ok: true; booking: PatientBookingLookup }
  | { ok: false; error: string }
> {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { ok: false, error: "Enter your booking reference." };
  }

  const id = value.trim();
  if (id.length > 128) {
    return { ok: false, error: "Booking reference was not found." };
  }

  try {
    const booking = await getBooking(id);
    if (!booking) {
      return { ok: false, error: "No booking was found with that reference." };
    }
    return {
      ok: true,
      booking: {
        id: booking.id,
        slot_id: booking.slot_id,
        status: booking.status,
        created_at: booking.created_at,
      },
    };
  } catch {
    return {
      ok: false,
      error: "Booking lookup is temporarily unavailable. Please try again.",
    };
  }
}

export async function listPatientBookings(
  emailValue: unknown,
  cursorValue: unknown = null,
): Promise<
  | { ok: true; page: PatientBookingPage }
  | { ok: false; error: string }
> {
  if (typeof emailValue !== "string" || emailValue.trim().length === 0) {
    return { ok: false, error: "Enter the email address used for booking." };
  }
  const email = emailValue.trim();
  if (
    email.length > 254 ||
    !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i.test(
      email,
    )
  ) {
    return { ok: false, error: "Enter a valid email address." };
  }

  if (
    cursorValue !== null &&
    (typeof cursorValue !== "string" || cursorValue.length > 2048)
  ) {
    return { ok: false, error: "Could not load the next page. Start again." };
  }

  try {
    const result = await listBookings(email, 10, cursorValue);
    if (!result.ok) {
      return { ok: false, error: "Could not load bookings. Start again." };
    }
    return {
      ok: true,
      page: {
        bookings: result.bookings.map((booking) => ({
          id: booking.id,
          slot_id: booking.slot_id,
          status: booking.status,
          created_at: booking.created_at,
        })),
        next_cursor: result.next_cursor,
      },
    };
  } catch {
    return {
      ok: false,
      error: "Booking history is temporarily unavailable. Please try again.",
    };
  }
}
