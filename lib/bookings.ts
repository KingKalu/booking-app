import { randomUUID } from "node:crypto";
import { getDatabase, getMongoClient } from "@/lib/mongodb";
import type { AvailableSlot, Booking, NewBooking, Slot } from "@/lib/types";

type SlotDocument = Omit<Slot, "start" | "end"> & {
  start: Date;
  end: Date;
};

type BookingDocument = Omit<Booking, "created_at"> & { created_at: Date };

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

export async function createBooking(input: NewBooking): Promise<Booking | null> {
  const db = await getDatabase();
  const slot = await db.collection<SlotDocument>("slots").findOne({
    id: input.slot_id,
  }, { projection: { _id: 1 } });
  if (slot === null) {
    return null;
  }

  const booking: BookingDocument = {
    id: randomUUID(),
    slot_id: input.slot_id,
    name: input.name,
    email: input.email,
    status: "confirmed",
    created_at: new Date(),
  };
  await db.collection<BookingDocument>("bookings").insertOne(booking);
  return serializeBooking(booking);
}

export async function getBooking(id: string): Promise<Booking | null> {
  const db = await getDatabase();
  const booking = await db.collection<BookingDocument>("bookings").findOne({
    id,
  });

  return booking === null ? null : serializeBooking(booking);
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
