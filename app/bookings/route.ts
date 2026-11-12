import { NextResponse } from "next/server";
import { createBooking } from "@/lib/bookings";
import type { NewBooking } from "@/lib/types";

export const runtime = "nodejs";

function isNewBooking(value: unknown): value is NewBooking {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const booking = value as Record<string, unknown>;
  return (
    typeof booking.slot_id === "string" &&
    typeof booking.name === "string" &&
    typeof booking.email === "string"
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!isNewBooking(body)) {
    return NextResponse.json({ error: "invalid booking" }, { status: 400 });
  }

  try {
    const booking = await createBooking(body);
    if (!booking) {
      return NextResponse.json({ error: "slot not found" }, { status: 404 });
    }
    return NextResponse.json(booking, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}
