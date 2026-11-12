import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/api-auth";
import { listSlots } from "@/lib/bookings";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authorizationError = authorizeApiRequest(request);
  if (authorizationError) {
    return authorizationError;
  }

  try {
    const provider = new URL(request.url).searchParams.get("provider");
    const slots = await listSlots(provider);
    return NextResponse.json({ slots });
  } catch {
    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}
