"use client";

import { useState, type FormEvent } from "react";
import type { AvailableSlot, Booking } from "@/lib/types";

interface BookingFormProps {
  initialSlots: AvailableSlot[];
  initialError: string | null;
}

interface SlotListResponse {
  slots: AvailableSlot[];
}

interface ErrorResponse {
  error?: string;
}

interface Confirmation {
  booking: Booking;
  slot: AvailableSlot;
}

function formatSlot(slot: AvailableSlot): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `${formatter.format(new Date(slot.start))} - ${formatter.format(
    new Date(slot.end),
  )} (${timeZone})`;
}

export default function BookingForm({
  initialSlots,
  initialError,
}: BookingFormProps) {
  const [slots, setSlots] = useState(initialSlots);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [error, setError] = useState(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function refreshSlots() {
    setIsRefreshing(true);
    try {
      const response = await fetch("/slots", { cache: "no-store" });
      const result = (await response.json()) as SlotListResponse | ErrorResponse;
      if (!response.ok || !("slots" in result)) {
        throw new Error("Availability is temporarily unavailable.");
      }
      setSlots(result.slots);
    } finally {
      setIsRefreshing(false);
    }
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setConfirmation(null);
    setIsSubmitting(true);

    const formData = new FormData(form);
    const bookedSlot = slots.find((slot) => slot.id === selectedSlot);
    if (!bookedSlot) {
      setError("Choose an available appointment before booking.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_id: selectedSlot,
          name: formData.get("name"),
          email: formData.get("email"),
        }),
      });
      const result = (await response.json()) as Booking | ErrorResponse;
      if (!response.ok || !("id" in result)) {
        setError(
          "error" in result && result.error
            ? result.error
            : "Your booking could not be completed. Please try again.",
        );
        return;
      }

      setConfirmation({ booking: result, slot: bookedSlot });
      setSelectedSlot("");
      form.reset();
      try {
        await refreshSlots();
      } catch {
        setError(
          "Your booking is confirmed, but availability could not be refreshed.",
        );
      }
    } catch {
      setError("The booking service is unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="booking-layout" aria-labelledby="availability-heading">
      <div className="slots-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Availability</p>
            <h2 id="availability-heading">Available appointments</h2>
          </div>
          <button
            className="text-button"
            type="button"
            disabled={isRefreshing || isSubmitting}
            onClick={() => {
              setError(null);
              refreshSlots().catch(() =>
                setError("Availability is temporarily unavailable. Please try again."),
              );
            }}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {slots.length === 0 ? (
          <p className="empty-state">
            {error ?? "There are no appointments available right now."}
          </p>
        ) : (
          <fieldset className="slot-list">
            <legend className="visually-hidden">Choose an appointment</legend>
            {slots.map((slot) => (
              <label className="slot-option" key={slot.id}>
                <input
                  type="radio"
                  name="slot"
                  value={slot.id}
                  checked={selectedSlot === slot.id}
                  disabled={!slot.available || isSubmitting}
                  onChange={() => setSelectedSlot(slot.id)}
                />
                <span className="slot-copy">
                  <strong>{slot.provider}</strong>
                  <span>{formatSlot(slot)}</span>
                </span>
                <span
                  className={`availability ${
                    slot.available ? "available" : "unavailable"
                  }`}
                >
                  {slot.available ? "Available" : "Booked"}
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </div>

      <div className="form-panel" aria-busy={isSubmitting}>
        <p className="eyebrow">Your details</p>
        <h2>Book an appointment</h2>
        <form onSubmit={submitBooking}>
          <label htmlFor="patient-name">Name</label>
          <input
            id="patient-name"
            name="name"
            autoComplete="name"
            required
            disabled={isSubmitting}
          />

          <label htmlFor="patient-email">Email</label>
          <input
            id="patient-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={isSubmitting}
          />

          <button
            className="primary-button"
            type="submit"
            disabled={!selectedSlot || isSubmitting}
          >
            {isSubmitting ? "Booking..." : "Book appointment"}
          </button>
        </form>

        {error && (
          <p className="message error-message" role="alert">
            {error}
          </p>
        )}
        {confirmation && (
          <div className="message success-message" role="status">
            <h3>Appointment confirmed</h3>
            <p>Booking reference: {confirmation.booking.id}</p>
            <p>
              {confirmation.slot.provider}: {formatSlot(confirmation.slot)}
            </p>
            <p>
              Your appointment is booked. Please keep this reference for your
              records.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
