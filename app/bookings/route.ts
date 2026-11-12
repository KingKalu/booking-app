import { NextResponse } from "next/server";
import { createBooking } from "@/lib/bookings";
import { authorizeApiRequest } from "@/lib/api-auth";
import { readLimitedJsonBody } from "@/lib/api-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authorizationError = authorizeApiRequest(request);
  if (authorizationError) {
    return authorizationError;
  }

  const body = await readLimitedJsonBody(request);
  if (!body.ok) {
    return NextResponse.json(
      { error: body.error },
      { status: body.status },
    );
  }

  try {
    const result = await createBooking(body.value);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.booking, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}
