import "dotenv/config";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI must be configured before running npm run seed");
}

const client = new MongoClient(uri);
const database = client.db(process.env.MONGODB_DB || "clinic_booking");

function slotTime(daysFromToday, hour) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

const demoSlots = [
  { id: "demo-slot-1", provider: "Dr. Avery Chen", day: 1, hour: 9 },
  { id: "demo-slot-2", provider: "Dr. Avery Chen", day: 1, hour: 10 },
  { id: "demo-slot-3", provider: "Dr. Jordan Lee", day: 2, hour: 13 },
  { id: "demo-slot-4", provider: "Dr. Jordan Lee", day: 2, hour: 14 },
].map(({ id, provider, day, hour }) => {
  const start = slotTime(day, hour);
  return {
    id,
    provider,
    start,
    end: new Date(start.getTime() + 30 * 60 * 1000),
  };
});

try {
  await client.connect();
  await Promise.all([
    database.collection("slots").createIndex({ id: 1 }, { unique: true }),
    database.collection("bookings").createIndex({ id: 1 }, { unique: true }),
  ]);
  await database.collection("slots").bulkWrite(
    demoSlots.map((slot) => ({
      updateOne: {
        filter: { id: slot.id },
        update: { $setOnInsert: slot },
        upsert: true,
      },
    })),
    { ordered: true },
  );
  console.log("MongoDB indexes are ready and demo slots are seeded.");
} finally {
  await client.close();
}
