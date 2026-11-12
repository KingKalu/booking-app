"use server";

import { createBooking, listSlots } from "@/lib/bookings";
import type { AvailableSlot } from "@/lib/types";

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
