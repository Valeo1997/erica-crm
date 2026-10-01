'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Appointment, BookingSlot } from '@/lib/types';
import { btnDanger, btnSecondary } from '@/app/crm/components/record-ui';

const WINDOWS: { id: BookingSlot['window']; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'midday', label: 'Midday' },
  { id: 'late_afternoon', label: 'Late afternoon' },
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function dayLabelLong(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const EMERGENCY_STYLES: Record<string, string> = {
  emergency: 'bg-red-500/15 text-red-400 ring-red-500/40',
  urgent: 'bg-ember/15 text-ember ring-ember/40',
};
const EMERGENCY_FALLBACK = 'bg-soot text-fog ring-seam';

function EmergencyBadge({ level }: { level: string }) {
  const classes = EMERGENCY_STYLES[level.toLowerCase()] ?? EMERGENCY_FALLBACK;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${classes}`}
    >
      {level}
    </span>
  );
}

/* Two-step cancel: first click arms, second confirms. Calls the tenant-checked
   cancel_appointment RPC (releases the slot count server-side), then asks the
   parent to revalidate. */
function CancelAppointmentButton({
  appointmentId,
  onCancelled,
}: {
  appointmentId: string;
  onCancelled: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    setIsCancelling(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('cancel_appointment', {
      p_appointment_id: appointmentId,
    });
    setIsCancelling(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (data !== true) {
      setError('Could not cancel.');
      return;
    }
    setConfirming(false);
    await onCancelled();
  };

  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-2">
        {error && <span className="text-xs text-red-400">{error}</span>}
        <button
          type="button"
          onClick={handleCancel}
          disabled={isCancelling}
          className={btnDanger}
        >
          {isCancelling ? 'Cancelling…' : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setConfirming(false);
          }}
          disabled={isCancelling}
          className={btnSecondary}
        >
          Keep
        </button>
      </span>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
      {error && <span className="text-xs text-red-400">{error}</span>}
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        className={btnDanger}
      >
        Cancel
      </button>
    </span>
  );
}

export default function BookingsPage({
  params,
}: {
  params: Promise<{ sub_account_id: string }>;
}) {
  const { sub_account_id } = use(params);

  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [leadEmergency, setLeadEmergency] = useState<Map<string, string>>(new Map());
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedISO, setSelectedISO] = useState<string | null>(null);

  /* Pure fetch — no setState, shared between the mount effect and the
     post-cancel revalidate (same pattern as the contacts page). */
  const fetchRecords = useCallback(async () => {
    const today = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 6);

    const empty = {
      slots: [] as BookingSlot[],
      appointments: [] as Appointment[],
      emergencies: new Map<string, string>(),
    };
    const slotsRes = await supabase
      .from('booking_slots')
      .select('*')
      .eq('sub_account_id', sub_account_id)
      .gte('slot_date', toISODate(today))
      .lte('slot_date', toISODate(end))
      .order('slot_date', { ascending: true });
    if (slotsRes.error) {
      console.error('Failed to load booking slots:', slotsRes.error.message);
      return { ...empty, error: slotsRes.error.message as string | null };
    }
    const slots = (slotsRes.data ?? []) as BookingSlot[];

    let appointments: Appointment[] = [];
    if (slots.length > 0) {
      const apptRes = await supabase
        .from('appointments')
        .select('*')
        .eq('sub_account_id', sub_account_id)
        .eq('status', 'booked')
        .in('slot_id', slots.map((s) => s.slot_id))
        .order('created_at', { ascending: true });
      if (apptRes.error) {
        console.error('Failed to load appointments:', apptRes.error.message);
      } else {
        appointments = (apptRes.data ?? []) as Appointment[];
      }
    }

    const emergencies = new Map<string, string>();
    const leadIds = [
      ...new Set(appointments.map((a) => a.lead_id).filter((id): id is string => id !== null)),
    ];
    if (leadIds.length > 0) {
      const leadsRes = await supabase
        .from('plumbing_leads')
        .select('lead_id, emergency_level')
        .in('lead_id', leadIds);
      if (leadsRes.error) {
        console.error('Failed to load linked leads:', leadsRes.error.message);
      } else {
        for (const row of leadsRes.data ?? []) {
          emergencies.set(row.lead_id as string, row.emergency_level as string);
        }
      }
    }

    return { slots, appointments, emergencies, error: null as string | null };
  }, [sub_account_id]);

  useEffect(() => {
    let isMounted = true;
    fetchRecords().then((result) => {
      if (!isMounted) return;
      if (result.error) {
        setSetupError(result.error);
      } else {
        setSlots(result.slots);
        setAppointments(result.appointments);
        setLeadEmergency(result.emergencies);
      }
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [fetchRecords]);

  /* Silent revalidate after a cancellation. */
  const reload = async () => {
    const result = await fetchRecords();
    if (result.error) return;
    setSlots(result.slots);
    setAppointments(result.appointments);
    setLeadEmergency(result.emergencies);
  };

  /* Appointments grouped by the slot they belong to. */
  const appointmentsBySlot = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const list = map.get(a.slot_id);
      if (list) list.push(a);
      else map.set(a.slot_id, [a]);
    }
    return map;
  }, [appointments]);

  const todayISO = toISODate(new Date());

  /* Today through +6 = a 7-day window, each day carrying its configured slots. */
  const weekDays = useMemo(() => {
    const days: { iso: string; slots: BookingSlot[] }[] = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = toISODate(d);
      days.push({
        iso,
        slots: WINDOWS.map(
          (w) => slots.find((s) => s.slot_date === iso && s.window === w.id) ?? null
        ).filter((s): s is BookingSlot => s !== null),
      });
    }
    return days;
  }, [slots]);

  const selectedDay = useMemo(
    () => (selectedISO ? weekDays.find((d) => d.iso === selectedISO) ?? null : null),
    [selectedISO, weekDays]
  );

  /* Close the detail modal on Escape. */
  useEffect(() => {
    if (!selectedISO) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedISO(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedISO]);

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl uppercase leading-none tracking-tight text-cream sm:text-4xl">
              Bookings
            </h1>
            <p className="mt-2 text-sm text-fog">
              The next 7 days — tap any day to see windows and who&apos;s booked.
            </p>
          </div>
          <span className="rounded-full border border-seam bg-coal px-3 py-1 text-xs font-medium text-fog">
            Account <span className="font-mono">{sub_account_id}</span>
          </span>
        </header>

        {isLoading && (
          <p className="rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
            Loading bookings…
          </p>
        )}

        {!isLoading && setupError && (
          <p className="rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
            Booking isn&apos;t set up for this account yet.
          </p>
        )}

        {!isLoading && !setupError && (
          weekDays.every((d) => d.slots.length === 0) ? (
            <p className="rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
              No booking windows configured yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {weekDays.map((day) => {
                const isToday = day.iso === todayISO;
                const booked = day.slots.reduce((n, s) => n + s.booked_count, 0);
                const capacity = day.slots.reduce((n, s) => n + s.capacity, 0);
                return (
                  <button
                    key={day.iso}
                    type="button"
                    onClick={() => setSelectedISO(day.iso)}
                    className="group flex flex-col rounded-2xl border border-seam bg-coal p-6 text-left transition-colors hover:border-ember/50 hover:bg-coal/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ember/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {isToday && (
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ember">
                            Today
                          </span>
                        )}
                        <h3 className="font-display text-xl uppercase leading-tight tracking-tight text-cream">
                          {dayLabel(day.iso)}
                        </h3>
                      </div>
                      <span className="shrink-0 rounded-full bg-soot px-2.5 py-1 text-xs font-semibold tabular-nums text-fog">
                        {booked}/{capacity}
                      </span>
                    </div>

                    <div className="mt-5 flex-1 space-y-3.5">
                      {day.slots.length === 0 ? (
                        <p className="text-xs text-ash">No windows configured</p>
                      ) : (
                        day.slots.map((slot) => {
                          const window = WINDOWS.find((w) => w.id === slot.window);
                          const isFull = slot.booked_count >= slot.capacity;
                          const pct = Math.min(
                            100,
                            slot.capacity > 0 ? (slot.booked_count / slot.capacity) * 100 : 0
                          );
                          return (
                            <div key={slot.slot_id} className="flex items-center gap-3">
                              <span className="w-24 shrink-0 text-xs text-fog">
                                {window?.label ?? slot.window}
                              </span>
                              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-soot">
                                <span
                                  className={`block h-full rounded-full ${isFull ? 'bg-flare' : 'bg-ember'}`}
                                  style={{ width: `${Math.max(pct, slot.booked_count > 0 ? 6 : 0)}%` }}
                                />
                              </span>
                              <span
                                className={`w-10 shrink-0 text-right text-xs font-semibold tabular-nums ${
                                  isFull ? 'text-flare' : 'text-fog'
                                }`}
                              >
                                {slot.booked_count}/{slot.capacity}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <span className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-fog transition-colors group-hover:text-ember">
                      {booked > 0 ? `${booked} booked` : 'All open'}
                      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                        →
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Day detail modal */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Bookings for ${dayLabelLong(selectedDay.iso)}`}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedISO(null)}
          />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-seam bg-coal shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-seam px-6 py-4">
              <div>
                {selectedDay.iso === todayISO && (
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ember">
                    Today
                  </span>
                )}
                <h2 className="font-display text-2xl uppercase leading-tight tracking-tight text-cream">
                  {dayLabelLong(selectedDay.iso)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedISO(null)}
                className="shrink-0 rounded-lg p-1.5 text-fog transition-colors hover:bg-soot hover:text-cream"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {selectedDay.slots.length === 0 ? (
                <p className="py-10 text-center text-sm text-fog">
                  No booking windows configured for this day.
                </p>
              ) : (
                <div className="space-y-6">
                  {WINDOWS.map((w) => {
                    const slot = selectedDay.slots.find((s) => s.window === w.id);
                    if (!slot) return null;
                    const appts = appointmentsBySlot.get(slot.slot_id) ?? [];
                    const isFull = slot.booked_count >= slot.capacity;
                    return (
                      <section key={w.id}>
                        <div className="mb-2.5 flex items-center justify-between">
                          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-ember">
                            {w.label}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                              isFull ? 'bg-flare/15 text-flare' : 'bg-soot text-fog'
                            }`}
                          >
                            {slot.booked_count}/{slot.capacity} {isFull ? 'full' : 'booked'}
                          </span>
                        </div>
                        {appts.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-seam px-3 py-3 text-xs text-ash">
                            No bookings yet — {slot.capacity} open.
                          </p>
                        ) : (
                          <ul className="divide-y divide-seam rounded-lg border border-seam">
                            {appts.map((a) => {
                              const emergency = a.lead_id
                                ? leadEmergency.get(a.lead_id)
                                : undefined;
                              return (
                                <li
                                  key={a.appointment_id}
                                  className="flex items-center gap-3 px-3 py-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-cream">
                                      {a.lead_id ? (
                                        <Link
                                          href={`/crm/${sub_account_id}/leads/${a.lead_id}`}
                                          className="transition-colors hover:text-ember"
                                        >
                                          {a.customer_name}
                                        </Link>
                                      ) : (
                                        a.customer_name
                                      )}
                                    </p>
                                    {a.customer_phone && (
                                      <p className="mt-0.5 font-mono text-xs text-fog">
                                        {a.customer_phone}
                                      </p>
                                    )}
                                  </div>
                                  {emergency && <EmergencyBadge level={emergency} />}
                                  <CancelAppointmentButton
                                    appointmentId={a.appointment_id}
                                    onCancelled={reload}
                                  />
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
