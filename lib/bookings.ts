import { createHash, randomUUID } from "node:crypto";
import {
  MongoServerError,
  type Collection,
  type Filter,
} from "mongodb";
import { getDatabase, getMongoClient } from "@/lib/mongodb";
import type { AvailableSlot, Booking, NewBooking, Slot } from "@/lib/types";

type SlotDocument = Omit<Slot, "start" | "end"> & {
  start: Date;
  end: Date;
};

type BookingDocument = Omit<Booking, "created_at"> & {
  created_at: Date;
  idempotency_key?: string;
  request_hash?: string;
  idempotency_response?: Booking;
};

type BookingRateLimitDocument = {
  _id: string;
  attempts: Date[];
  updated_at: Date;
  last_attempt_allowed: boolean;
};

let bookingIndexesPromise: Promise<void> | undefined;
let rateLimitIndexPromise: Promise<string> | undefined;

async function ensureBookingIndexes(
  bookings: Collection<BookingDocument>,
): Promise<void> {
  if (!bookingIndexesPromise) {
    bookingIndexesPromise = Promise.all([
      bookings.createIndex(
        { slot_id: 1 },
        {
          name: "unique_confirmed_booking_per_slot",
          unique: true,
          partialFilterExpression: { status: "confirmed" },
        },
      ),
      bookings.createIndex(
        { idempotency_key: 1 },
        {
          name: "unique_booking_idempotency_key",
          unique: true,
          partialFilterExpression: { idempotency_key: { $exists: true } },
        },
      ),
    ]).then(() => undefined).catch((error: unknown) => {
      bookingIndexesPromise = undefined;
      throw error;
    });
  }
  await bookingIndexesPromise;
}

async function ensureRateLimitIndex(
  collection: Collection<BookingRateLimitDocument>,
): Promise<void> {
  if (!rateLimitIndexPromise) {
    rateLimitIndexPromise = collection.createIndex(
      { updated_at: 1 },
      { name: "expire_booking_rate_limits", expireAfterSeconds: 120 },
    ).catch((error: unknown) => {
      rateLimitIndexPromise = undefined;
      throw error;
    });
  }
  await rateLimitIndexPromise;
}

function extractRateLimitEmail(value: unknown): string | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("email" in value) ||
    typeof value.email !== "string"
  ) {
    return null;
  }
  const email = value.email.trim().toLowerCase();
  return email.length === 0 ? null : email;
}

async function consumeBookingAttempt(email: string): Promise<
  | { allowed: true }
  | { allowed: false; retryAfter: number }
> {
  const db = await getDatabase();
  const rateLimits = db.collection<BookingRateLimitDocument>("booking_rate_limits");
  await ensureRateLimitIndex(rateLimits);

  const now = new Date();
  const cutoff = new Date(now.getTime() - 60_000);
  const filter = {
    _id: createHash("sha256").update(email).digest("hex"),
  };
  const update = [
    {
      $set: {
        attempts: {
          $filter: {
            input: { $ifNull: ["$attempts", []] },
            as: "attempt",
            cond: { $gte: ["$$attempt", { $literal: cutoff }] },
          },
        },
      },
    },
    {
      $set: {
        last_attempt_allowed: { $lt: [{ $size: "$attempts" }, 5] },
        attempts: {
          $cond: [
            { $lt: [{ $size: "$attempts" }, 5] },
            { $concatArrays: ["$attempts", [{ $literal: now }]] },
            "$attempts",
          ],
        },
        updated_at: { $literal: now },
      },
    },
  ];

  let result: BookingRateLimitDocument | null;
  try {
    result = await rateLimits.findOneAndUpdate(filter, update, {
      upsert: true,
      returnDocument: "after",
      includeResultMetadata: false,
    });
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) {
      throw error;
    }
    result = await rateLimits.findOneAndUpdate(filter, update, {
      returnDocument: "after",
      includeResultMetadata: false,
    });
  }

  if (result === null) {
    throw new Error("could not record booking attempt");
  }
  if (result.last_attempt_allowed) {
    return { allowed: true };
  }

  const oldestAttempt = result.attempts[0];
  return {
    allowed: false,
    retryAfter: Math.max(
      1,
      Math.ceil((oldestAttempt.getTime() + 60_000 - now.getTime()) / 1000),
    ),
  };
}

function serializeBooking(booking: BookingDocument): Booking {
  return {
    id: booking.id,
    slot_id: booking.slot_id,
    name: booking.name,
    email: booking.email,
    status: booking.status,
    created_at: booking.created_at.toISOString(),
  };
}

export async function listSlots(
  provider: string | null = null,
): Promise<AvailableSlot[]> {
  const db = await getDatabase();
  const slotQuery = provider === null ? {} : { provider };

  const [slotRows, bookingRows] = await Promise.all([
    db.collection<SlotDocument>("slots")
      .find(slotQuery)
      .sort({ start: 1 })
      .toArray(),
    db.collection<BookingDocument>("bookings")
      .find({ status: "confirmed" }, { projection: { slot_id: 1, _id: 0 } })
      .toArray(),
  ]);

  const bookedSlotIds = new Set(bookingRows.map((booking) => booking.slot_id));
  return slotRows.map((slot) => ({
    id: slot.id,
    provider: slot.provider,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    available: !bookedSlotIds.has(slot.id),
  }));
}

export type BookingCreationResult =
  | { ok: true; booking: Booking }
  | { ok: false; status: 400 | 404 | 409 | 422; error: string }
  | {
      ok: false;
      status: 429;
      error: string;
      retryAfter: number;
    };

function normalizeBookingInput(value: unknown):
  | { ok: true; input: NewBooking }
  | { ok: false; error: string } {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "invalid booking" };
  }

  const booking = value as Record<string, unknown>;
  if (
    typeof booking.slot_id !== "string" ||
    typeof booking.name !== "string" ||
    typeof booking.email !== "string"
  ) {
    return { ok: false, error: "slot_id, name, and email are required" };
  }

  const name = booking.name.trim();
  const email = booking.email.trim();
  if (
    booking.slot_id.trim().length === 0 ||
    name.length === 0 ||
    email.length === 0
  ) {
    return { ok: false, error: "slot_id, name, and email are required" };
  }

  const emailPattern =
    /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i;
  if (!emailPattern.test(email)) {
    return { ok: false, error: "email must be valid" };
  }

  return {
    ok: true,
    input: { slot_id: booking.slot_id, name, email: email.toLowerCase() },
  };
}

export async function createBooking(
  value: unknown,
  idempotencyKey?: string,
): Promise<BookingCreationResult> {
  const rateLimitEmail = extractRateLimitEmail(value);
  if (rateLimitEmail !== null) {
    const attempt = await consumeBookingAttempt(rateLimitEmail);
    if (!attempt.allowed) {
      return {
        ok: false,
        status: 429,
        error: "too many booking attempts",
        retryAfter: attempt.retryAfter,
      };
    }
  }

  const normalized = normalizeBookingInput(value);
  if (!normalized.ok) {
    return { ok: false, status: 400, error: normalized.error };
  }

  const input = normalized.input;
  const db = await getDatabase();
  const bookings = db.collection<BookingDocument>("bookings");
  await ensureBookingIndexes(bookings);

  const requestHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  if (idempotencyKey !== undefined) {
    const previousBooking = await bookings.findOne({
      idempotency_key: idempotencyKey,
    });
    if (previousBooking) {
      if (previousBooking.request_hash !== requestHash) {
        return {
          ok: false,
          status: 422,
          error: "idempotency key was already used with a different request",
        };
      }
      if (previousBooking.idempotency_response) {
        return { ok: true, booking: previousBooking.idempotency_response };
      }
      throw new Error("idempotent booking is missing its original response");
    }
  }

  const slot = await db.collection<SlotDocument>("slots").findOne({
    id: input.slot_id,
  }, { projection: { start: 1, _id: 0 } });
  if (slot === null) {
    return { ok: false, status: 404, error: "slot not found" };
  }
  if (slot.start.getTime() <= Date.now()) {
    return { ok: false, status: 400, error: "slot has already started" };
  }

  const booking: BookingDocument = {
    id: randomUUID(),
    slot_id: input.slot_id,
    name: input.name,
    email: input.email,
    status: "confirmed",
    created_at: new Date(),
    ...(idempotencyKey === undefined
      ? {}
      : { idempotency_key: idempotencyKey, request_hash: requestHash }),
  };
  if (idempotencyKey !== undefined) {
    booking.idempotency_response = {
      id: booking.id,
      slot_id: booking.slot_id,
      name: booking.name,
      email: booking.email,
      status: booking.status,
      created_at: booking.created_at.toISOString(),
    };
  }

  try {
    await bookings.insertOne(booking);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      if (idempotencyKey !== undefined) {
        const previousBooking = await bookings.findOne({
          idempotency_key: idempotencyKey,
        });
        if (previousBooking) {
          if (previousBooking.request_hash !== requestHash) {
            return {
              ok: false,
              status: 422,
              error: "idempotency key was already used with a different request",
            };
          }
          if (previousBooking.idempotency_response) {
            return { ok: true, booking: previousBooking.idempotency_response };
          }
          throw new Error("idempotent booking is missing its original response");
        }
      }
      return { ok: false, status: 409, error: "slot is already booked" };
    }
    throw error;
  }
  return { ok: true, booking: serializeBooking(booking) };
}

export type BookingCancellationResult =
  | { ok: true; booking: Booking }
  | { ok: false; status: 404 | 409; error: string };

export async function cancelBooking(
  id: string,
): Promise<BookingCancellationResult> {
  const db = await getDatabase();
  const bookings = db.collection<BookingDocument>("bookings");
  const booking = await bookings.findOneAndUpdate(
    { id, status: "confirmed" },
    { $set: { status: "cancelled" } },
    { returnDocument: "after", includeResultMetadata: false },
  );

  if (booking) {
    return { ok: true, booking: serializeBooking(booking) };
  }

  const existingBooking = await bookings.findOne({ id });
  if (!existingBooking) {
    return { ok: false, status: 404, error: "booking not found" };
  }
  return { ok: false, status: 409, error: "booking is already cancelled" };
}

export async function getBooking(id: string): Promise<Booking | null> {
  const db = await getDatabase();
  const booking = await db.collection<BookingDocument>("bookings").findOne({
    id,
  });

  return booking === null ? null : serializeBooking(booking);
}

export type BookingPageResult =
  | { ok: true; bookings: Booking[]; next_cursor: string | null }
  | { ok: false; error: string };

function decodeBookingCursor(
  cursor: string,
): { created_at: Date; id: string } | null {
  try {
    const value: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    if (typeof value !== "object" || value === null) {
      return null;
    }
    const data = value as Record<string, unknown>;
    if (typeof data.created_at !== "string" || typeof data.id !== "string") {
      return null;
    }
    const createdAt = new Date(data.created_at);
    if (!Number.isFinite(createdAt.getTime()) || data.id.length === 0) {
      return null;
    }
    return { created_at: createdAt, id: data.id };
  } catch {
    return null;
  }
}

function encodeBookingCursor(booking: BookingDocument): string {
  return Buffer.from(
    JSON.stringify({
      created_at: booking.created_at.toISOString(),
      id: booking.id,
    }),
  ).toString("base64url");
}

export async function listBookings(
  email: string,
  limit: number,
  cursor: string | null,
): Promise<BookingPageResult> {
  const decodedCursor = cursor === null ? null : decodeBookingCursor(cursor);
  if (cursor !== null && decodedCursor === null) {
    return { ok: false, error: "invalid cursor" };
  }

  const query: Filter<BookingDocument> = {
    email: email.trim().toLowerCase(),
  };
  if (decodedCursor) {
    query.$or = [
      { created_at: { $gt: decodedCursor.created_at } },
      { created_at: decodedCursor.created_at, id: { $gt: decodedCursor.id } },
    ];
  }

  const rows = await (await getDatabase())
    .collection<BookingDocument>("bookings")
    .find(query)
    .sort({ created_at: 1, id: 1 })
    .limit(limit + 1)
    .toArray();
  const hasNextPage = rows.length > limit;
  const page = hasNextPage ? rows.slice(0, limit) : rows;
  return {
    ok: true,
    bookings: page.map(serializeBooking),
    next_cursor: hasNextPage
      ? encodeBookingCursor(page[page.length - 1])
      : null,
  };
}

export async function replaceSlots(slots: Slot[]): Promise<void> {
  const client = await getMongoClient();
  const db = client.db(process.env.MONGODB_DB || "clinic_booking");
  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      await db.collection("bookings").deleteMany({}, { session });
      await db.collection<SlotDocument>("slots").deleteMany({}, { session });
      if (slots.length > 0) {
        await db.collection<SlotDocument>("slots").insertMany(
          slots.map((slot) => ({
            ...slot,
            start: new Date(slot.start),
            end: new Date(slot.end),
          })),
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }
}
