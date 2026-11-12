import "server-only";

import { MongoClient } from "mongodb";

declare global {
  var bookingMongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI must be configured");
  }

  if (!globalThis.bookingMongoClientPromise) {
    const clientPromise = new MongoClient(uri).connect();
    globalThis.bookingMongoClientPromise = clientPromise;
    void clientPromise.catch(() => {
      if (globalThis.bookingMongoClientPromise === clientPromise) {
        globalThis.bookingMongoClientPromise = undefined;
      }
    });
  }

  return globalThis.bookingMongoClientPromise;
}

export async function getDatabase() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB || "clinic_booking");
}
