import BookingForm from "@/app/booking-form";
import { listSlots } from "@/lib/bookings";
import type { AvailableSlot } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let slots: AvailableSlot[] = [];
  let loadError: string | null = null;

  try {
    slots = await listSlots();
  } catch {
    loadError = "Availability is temporarily unavailable. Please try again.";
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <p className="eyebrow">Clinic appointments</p>
        <h1>Find a time that works for you</h1>
        <p className="intro">
          Choose an available appointment and enter your details to book.
        </p>
      </header>
      <BookingForm initialSlots={slots} initialError={loadError} />
    </main>
  );
}
