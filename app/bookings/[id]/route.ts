import { NextResponse } from "next/server";
import { getBooking } from "@/lib/bookings";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const booking = await getBooking(id);
    if (!booking) {
      return NextResponse.json({ error: "booking not found" }, { status: 404 });
    }
    return NextResponse.json(booking);
  } catch {
    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}
