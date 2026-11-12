import { NextResponse } from "next/server";
import { replaceSlots } from "@/lib/bookings";
import type { Slot } from "@/lib/types";

export const runtime = "nodejs";

function isSlot(value: unknown): value is Slot {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const slot = value as Record<string, unknown>;
  return (
    typeof slot.id === "string" &&
    typeof slot.provider === "string" &&
    typeof slot.start === "string" &&
    typeof slot.end === "string"
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("slots" in body) ||
    !Array.isArray(body.slots) ||
    !body.slots.every(isSlot)
  ) {
    return NextResponse.json({ error: "invalid slots" }, { status: 400 });
  }

  try {
    await replaceSlots(body.slots);
  } catch {
    return NextResponse.json(
      { error: "could not replace slots" },
      { status: 500 },
    );
  }

  return new Response(null, { status: 200 });
}
