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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${WEEKDAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
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

  /* Pure fetch — no setState, shared between the mount effect and the
     post-cancel revalidate (same pattern as the contacts page). */
  const fetchRecords = useCallback(async () => {
    const today = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 7);

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

  const slotById = useMemo(
    () => new Map(slots.map((s) => [s.slot_id, s])),
    [slots]
  );

  const todayISO = toISODate(new Date());

  const todaysAppointments = useMemo(
    () =>
      appointments
        .filter((a) => slotById.get(a.slot_id)?.slot_date === todayISO)
        .sort((a, b) => {
          const wa = WINDOWS.findIndex((w) => w.id === slotById.get(a.slot_id)?.window);
          const wb = WINDOWS.findIndex((w) => w.id === slotById.get(b.slot_id)?.window);
          return wa - wb;
        }),
    [appointments, slotById, todayISO]
  );

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((a) => {
          const date = slotById.get(a.slot_id)?.slot_date;
          return date !== undefined && date > todayISO;
        })
        .sort((a, b) => {
          const sa = slotById.get(a.slot_id);
          const sb = slotById.get(b.slot_id);
          const byDate = (sa?.slot_date ?? '').localeCompare(sb?.slot_date ?? '');
          if (byDate !== 0) return byDate;
          const wa = WINDOWS.findIndex((w) => w.id === sa?.window);
          const wb = WINDOWS.findIndex((w) => w.id === sb?.window);
          return wa - wb;
        }),
    [appointments, slotById, todayISO]
  );

  const upcomingDays = useMemo(() => {
    const days: { iso: string; slots: BookingSlot[] }[] = [];
    for (let i = 1; i <= 7; i++) {
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

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl uppercase leading-none tracking-tight text-cream sm:text-4xl">
              Bookings
            </h1>
            <p className="mt-2 text-sm text-fog">
              Who the AI receptionist booked, and what&apos;s still open.
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
          <>
            {/* Today */}
            <section className="rounded-xl border border-seam bg-coal">
              <div className="flex items-center justify-between border-b border-seam px-4 py-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-ember">
                  Today · {dayLabel(todayISO)}
                </h2>
                <span className="rounded-full bg-soot px-2 py-0.5 text-xs font-medium tabular-nums text-fog">
                  {todaysAppointments.length} booked
                </span>
              </div>
              {todaysAppointments.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-fog">
                  Nothing booked today.
                </p>
              ) : (
                <ul className="divide-y divide-seam">
                  {todaysAppointments.map((a) => {
                    const slot = slotById.get(a.slot_id);
                    const window = WINDOWS.find((w) => w.id === slot?.window);
                    const emergency = a.lead_id ? leadEmergency.get(a.lead_id) : undefined;
                    return (
                      <li key={a.appointment_id} className="flex items-center gap-3 px-4 py-3.5">
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
                        {window && (
                          <span className="shrink-0 rounded-full bg-ember/10 px-2.5 py-1 text-xs font-medium text-ember">
                            {window.label}
                          </span>
                        )}
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

            {/* Upcoming bookings */}
            <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-[0.15em] text-fog">
              Upcoming bookings
            </h2>
            {upcomingAppointments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-seam px-4 py-10 text-center text-sm text-fog">
                Nothing booked past today.
              </p>
            ) : (
              <ul className="divide-y divide-seam rounded-xl border border-seam bg-coal">
                {upcomingAppointments.map((a) => {
                  const slot = slotById.get(a.slot_id);
                  const window = WINDOWS.find((w) => w.id === slot?.window);
                  const emergency = a.lead_id ? leadEmergency.get(a.lead_id) : undefined;
                  return (
                    <li key={a.appointment_id} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="w-36 shrink-0">
                        <p className="text-sm font-semibold text-cream">
                          {slot ? dayLabel(slot.slot_date) : 'Unknown date'}
                        </p>
                        {window && <p className="mt-0.5 text-xs text-fog">{window.label}</p>}
                      </div>
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
                          <p className="mt-0.5 font-mono text-xs text-fog">{a.customer_phone}</p>
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

            {/* Next 7 days */}
            <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-[0.15em] text-fog">
              Next 7 days
            </h2>
            {upcomingDays.every((d) => d.slots.length === 0) ? (
              <p className="rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
                No booking windows configured yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {upcomingDays.map((day) => (
                  <section
                    key={day.iso}
                    className="rounded-xl border border-seam bg-coal"
                  >
                    <div className="border-b border-seam px-4 py-3">
                      <h3 className="text-sm font-semibold text-cream">{dayLabel(day.iso)}</h3>
                    </div>
                    <div className="space-y-3 p-4">
                      {day.slots.length === 0 && (
                        <p className="text-xs text-ash">No windows</p>
                      )}
                      {day.slots.map((slot) => {
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
                                style={{ width: `${Math.max(pct, slot.booked_count > 0 ? 4 : 0)}%` }}
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
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
