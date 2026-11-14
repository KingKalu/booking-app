"use client";

import { useState, type FormEvent } from "react";
import {
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

function getLocalDateKey(value: string): string {
  const date = new Date(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

export default function BookingForm({
  initialSlots,
  initialError,
}: BookingFormProps) {
  const [slots, setSlots] = useState(initialSlots);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [error, setError] = useState(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const providers = [...new Set(slots.map((slot) => slot.provider))].sort(
    (first, second) => first.localeCompare(second),
  );
  const dates = [...new Set(slots.map((slot) => getLocalDateKey(slot.start)))].sort();
  const filteredSlots = slots.filter((slot) => (
    (!selectedProvider || slot.provider === selectedProvider) &&
    (!selectedDate || getLocalDateKey(slot.start) === selectedDate) &&
    (!availableOnly || slot.available)
  ));
  const hasActiveFilters = Boolean(
    selectedProvider || selectedDate || availableOnly,
  );

  function clearFilters() {
    setSelectedProvider("");
    setSelectedDate("");
    setAvailableOnly(false);
    setSelectedSlot("");
  }

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
          <>
            <div className="slot-filters" aria-label="Filter appointments">
              <label className="filter-field">
                <span>Provider</span>
                <select
                  value={selectedProvider}
                  onChange={(event) => {
                    setSelectedProvider(event.target.value);
                    setSelectedSlot("");
                  }}
                >
                  <option value="">All providers</option>
                  {providers.map((provider) => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </label>
              <label className="filter-field">
                <span>Date</span>
                <select
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setSelectedSlot("");
                  }}
                >
                  <option value="">All dates</option>
                  {dates.map((date) => (
                    <option key={date} value={date}>{formatDateLabel(date)}</option>
                  ))}
                </select>
              </label>
              <label className="available-filter">
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(event) => {
                    setAvailableOnly(event.target.checked);
                    setSelectedSlot("");
                  }}
                />
                <span>Available only</span>
              </label>
              {hasActiveFilters && (
                <button className="text-button clear-filters" type="button" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>
            <p className="results-count" aria-live="polite">
              {filteredSlots.length} {filteredSlots.length === 1 ? "appointment" : "appointments"}
              {availableOnly ? " available" : ""}
            </p>
            {filteredSlots.length === 0 ? (
              <p className="empty-state">
                No appointments match those filters. Try another date or provider.
              </p>
            ) : (
              <fieldset className="slot-list">
                <legend className="visually-hidden">Choose an appointment</legend>
                {filteredSlots.map((slot) => (
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
          </>
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
