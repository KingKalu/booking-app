import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/api-auth";
import { cancelBooking, getBooking } from "@/lib/bookings";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorizationError = authorizeApiRequest(request);
  if (authorizationError) {
    return authorizationError;
  }

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

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorizationError = authorizeApiRequest(request);
  if (authorizationError) {
    return authorizationError;
  }

  try {
    const { id } = await context.params;
    const result = await cancelBooking(id);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.booking);
  } catch {
    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}
