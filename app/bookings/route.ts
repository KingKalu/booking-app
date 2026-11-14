import { NextResponse } from "next/server";
import { createBooking, listBookings } from "@/lib/bookings";
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
    const result = await createBooking(
      body.value,
      request.headers.get("Idempotency-Key") ?? undefined,
    );
    if (!result.ok) {
      const headers = result.status === 429
        ? { "Retry-After": String(result.retryAfter) }
        : undefined;
      return NextResponse.json({ error: result.error }, {
        status: result.status,
        headers,
      });
    }
    return NextResponse.json(result.booking, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const authorizationError = authorizeApiRequest(request);
  if (authorizationError) {
    return authorizationError;
  }

  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  if (!email || email.trim().length === 0) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const rawLimit = url.searchParams.get("limit");
  let limit = 10;
  if (rawLimit !== null) {
    if (!/^\d+$/.test(rawLimit)) {
      return NextResponse.json(
        { error: "limit must be an integer from 1 to 50" },
        { status: 400 },
      );
    }
    limit = Number(rawLimit);
    if (limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: "limit must be an integer from 1 to 50" },
        { status: 400 },
      );
    }
  }

  try {
    const result = await listBookings(
      email,
      limit,
      url.searchParams.get("cursor"),
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      bookings: result.bookings,
      next_cursor: result.next_cursor,
    });
  } catch {
    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}
