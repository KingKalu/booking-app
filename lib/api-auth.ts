import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export function authorizeApiRequest(request: Request): Response | null {
  const expected = process.env.BOOKING_API_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }

  const supplied = request.headers.get("X-API-Key");
  if (supplied === null) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  const matches =
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes);
  if (!matches) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return null;
}
