"use client";

import { useState, type FormEvent } from "react";
import {
  listPatientBookings,
  lookupPatientBooking,
  refreshPatientSlots,
  submitPatientBooking,
} from "@/app/actions/booking";
import type { AvailableSlot, Booking } from "@/lib/types";

interface BookingFormProps {
  initialSlots: AvailableSlot[];
  initialError: string | null;
}

interface Confirmation {
  booking: Booking;
  slot: AvailableSlot;
}

type BookingLookup = Pick<Booking, "id" | "slot_id" | "status" | "created_at">;

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
  const [lookup, setLookup] = useState<BookingLookup | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [bookingHistory, setBookingHistory] = useState<BookingLookup[]>([]);
  const [historyEmail, setHistoryEmail] = useState("");
  const [nextHistoryCursor, setNextHistoryCursor] = useState<string | null>(
    null,
  );
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  async function refreshSlots() {
    setIsRefreshing(true);
    try {
      const result = await refreshPatientSlots();
      if (!result.ok) {
        throw new Error(result.error);
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
      const result = await submitPatientBooking({
        slot_id: selectedSlot,
        name: formData.get("name"),
        email: formData.get("email"),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setConfirmation({ booking: result.booking, slot: bookedSlot });
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

  async function submitLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLookup(null);
    setLookupError(null);
    setIsLookingUp(true);

    try {
      const result = await lookupPatientBooking(
        formData.get("booking-reference"),
      );
      if (!result.ok) {
        setLookupError(result.error);
        return;
      }
      setLookup(result.booking);
    } catch {
      setLookupError(
        "Booking lookup is temporarily unavailable. Please try again.",
      );
    } finally {
      setIsLookingUp(false);
    }
  }

  async function loadBookingHistory(
    email: string,
    cursor: string | null,
    append: boolean,
  ) {
    setHistoryError(null);
    setIsLoadingHistory(true);
    try {
      const result = await listPatientBookings(email, cursor);
      if (!result.ok) {
        setHistoryError(result.error);
        if (!append) {
          setBookingHistory([]);
          setNextHistoryCursor(null);
        }
        return;
      }

      setHistoryEmail(email);
      setBookingHistory((current) =>
        append ? [...current, ...result.page.bookings] : result.page.bookings,
      );
      setNextHistoryCursor(result.page.next_cursor);
    } catch {
      setHistoryError(
        "Booking history is temporarily unavailable. Please try again.",
      );
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function submitBookingHistory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("history-email");
    if (typeof email !== "string") {
      setHistoryError("Enter the email address used for booking.");
      return;
    }
    await loadBookingHistory(email.trim(), null, false);
  }

  const lookupSlot = lookup
    ? slots.find((slot) => slot.id === lookup.slot_id)
    : undefined;

  return (
    <>
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
                  setError(
                    "Availability is temporarily unavailable. Please try again.",
                  ),
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

      <section className="lookup-panel" aria-labelledby="lookup-heading">
        <p className="eyebrow">Already booked?</p>
        <h2 id="lookup-heading">Look up your appointment</h2>
        <form className="lookup-form" onSubmit={submitLookup}>
          <label htmlFor="booking-reference">
            Booking reference
            <input
              id="booking-reference"
              name="booking-reference"
              autoComplete="off"
              required
              maxLength={128}
              disabled={isLookingUp}
            />
          </label>
          <button
            className="primary-button"
            type="submit"
            disabled={isLookingUp}
          >
            {isLookingUp ? "Looking up..." : "Find booking"}
          </button>
        </form>

        {lookupError && (
          <p className="message error-message" role="alert">
            {lookupError}
          </p>
        )}
        {lookup && (
          <div className="message success-message" role="status">
            <h3>Booking found</h3>
            <p>
              Status:{" "}
              <strong className={`booking-status ${lookup.status}`}>
                {lookup.status}
              </strong>
            </p>
            <p>
              {lookupSlot
                ? `${lookupSlot.provider}: ${formatSlot(lookupSlot)}`
                : `Appointment slot: ${lookup.slot_id}`}
            </p>
            <p>
              Reference: <strong>{lookup.id}</strong>
            </p>
            <p>
              Booked on: {new Date(lookup.created_at).toLocaleString()}
            </p>
          </div>
        )}
      </section>

      <section className="lookup-panel" aria-labelledby="history-heading">
        <p className="eyebrow">Booking history</p>
        <h2 id="history-heading">List your bookings</h2>
        <form className="lookup-form" onSubmit={submitBookingHistory}>
          <label htmlFor="history-email">
            Email used for booking
            <input
              id="history-email"
              name="history-email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              disabled={isLoadingHistory}
            />
          </label>
          <button
            className="primary-button"
            type="submit"
            disabled={isLoadingHistory}
          >
            {isLoadingHistory ? "Loading..." : "Find my bookings"}
          </button>
        </form>

        {historyError && (
          <p className="message error-message" role="alert">
            {historyError}
          </p>
        )}
        {bookingHistory.length > 0 && (
          <>
            <ol className="booking-history" aria-live="polite">
              {bookingHistory.map((booking) => {
                const slot = slots.find(
                  (availableSlot) => availableSlot.id === booking.slot_id,
                );
                return (
                  <li className="booking-history-item" key={booking.id}>
                    <div className="booking-history-heading">
                      <strong>{slot?.provider ?? `Slot ${booking.slot_id}`}</strong>
                      <span className={`booking-status ${booking.status}`}>
                        {booking.status}
                      </span>
                    </div>
                    <p>
                      {slot
                        ? formatSlot(slot)
                        : `Slot reference: ${booking.slot_id}`}
                    </p>
                    <p>
                      Booking reference: <strong>{booking.id}</strong>
                    </p>
                    <p>
                      Booked on:{" "}
                      {new Date(booking.created_at).toLocaleString()}
                    </p>
                  </li>
                );
              })}
            </ol>
            {nextHistoryCursor && (
              <button
                className="text-button load-more-button"
                type="button"
                disabled={isLoadingHistory}
                onClick={() =>
                  loadBookingHistory(
                    historyEmail,
                    nextHistoryCursor,
                    true,
                  )
                }
              >
                {isLoadingHistory ? "Loading..." : "Load more bookings"}
              </button>
            )}
          </>
        )}
        {historyEmail && bookingHistory.length === 0 && !historyError && (
          <p className="empty-state">No bookings found for that email address.</p>
        )}
      </section>
    </>
  );
}
