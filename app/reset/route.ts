import { NextResponse } from "next/server";
import { isValidSlot, replaceSlots } from "@/lib/bookings";
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

  if (
    typeof body.value !== "object" ||
    body.value === null ||
    !("slots" in body.value) ||
    !Array.isArray(body.value.slots) ||
    !body.value.slots.every(isValidSlot)
  ) {
    return NextResponse.json({ error: "invalid slots" }, { status: 400 });
  }

  try {
    await replaceSlots(body.value.slots);
  } catch {
    return NextResponse.json(
      { error: "could not replace slots" },
      { status: 500 },
    );
  }

  return new Response(null, { status: 200 });
}
