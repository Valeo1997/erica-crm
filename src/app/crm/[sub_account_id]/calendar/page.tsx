'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Appointment, BookingSlot, Lead } from '@/lib/types';
import { btnDanger, btnSecondary } from '@/app/crm/components/record-ui';

const WINDOWS: { id: BookingSlot['window']; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'midday', label: 'Midday' },
  { id: 'late_afternoon', label: 'Late afternoon' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const STATUS_LABEL: Record<Appointment['status'], string> = {
  booked: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
};

const STAGE_LABEL: Record<Lead['pipeline_stage'], string> = {
  new_lead: 'New lead',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal_sent: 'Proposal sent',
  closed_won: 'Closed won',
};

const EMERGENCY_STYLES: Record<string, string> = {
  emergency: 'bg-red-500/15 text-red-400 ring-red-500/40',
  urgent: 'bg-ember/15 text-ember ring-ember/40',
};
const EMERGENCY_FALLBACK = 'bg-soot text-fog ring-seam';

/* The lead fields the job card renders (appointments only carry name/phone). */
type LeadDetails = {
  lead_id: string;
  email: string | null;
  customer_address: string | null;
  plumbing_issue: string | null;
  emergency_level: string;
  pipeline_stage: Lead['pipeline_stage'];
  transcript: string | null;
};

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${WEEKDAYS[d.getDay()]} ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

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

/* Slide-over job card for one appointment — customer, status, schedule,
   issue, tags, transcript, and the two-step cancel. */
function JobCard({
  appointment,
  slot,
  lead,
  subAccountId,
  onClose,
  onCancelled,
}: {
  appointment: Appointment;
  slot: BookingSlot | undefined;
  lead: LeadDetails | undefined;
  subAccountId: string;
  onClose: () => void;
  onCancelled: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [issueExpanded, setIssueExpanded] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const slotWindow = WINDOWS.find((w) => w.id === slot?.window);
  const initial = appointment.customer_name.trim().charAt(0).toUpperCase() || '?';

  const handleCancel = async () => {
    setIsCancelling(true);
    setCancelError(null);
    const { data, error } = await supabase.rpc('cancel_appointment', {
      p_appointment_id: appointment.appointment_id,
    });
    setIsCancelling(false);
    if (error) {
      setCancelError(error.message);
      return;
    }
    if (data !== true) {
      setCancelError('Could not cancel.');
      return;
    }
    await onCancelled();
  };

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto border-l border-seam bg-coal">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-seam px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold uppercase tracking-[0.15em] text-fog transition-colors hover:text-cream"
          >
            ‹ Calendar
          </button>
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-ash">
            Booking
          </span>
        </div>

        <div className="flex-1 space-y-6 px-5 py-5">
          {/* Customer + status */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember/15 text-sm font-bold text-ember">
                {initial}
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-ash">Customer</p>
                <p className="text-lg font-semibold leading-tight text-cream">
                  {appointment.customer_name}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-ember/10 px-2.5 py-1 text-xs font-semibold text-ember">
              {STATUS_LABEL[appointment.status]}
            </span>
          </div>

          {/* Contact + actions */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-ash">Contact</p>
              {appointment.customer_phone ? (
                <a
                  href={`tel:${appointment.customer_phone}`}
                  className="mt-0.5 block font-mono text-sm text-cream transition-colors hover:text-ember"
                >
                  {appointment.customer_phone}
                </a>
              ) : (
                <p className="mt-0.5 text-sm text-fog">No phone captured</p>
              )}
              {lead?.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="mt-0.5 block text-sm text-cream transition-colors hover:text-ember"
                >
                  {lead.email}
                </a>
              )}
            </div>
            {appointment.lead_id && (
              <Link
                href={`/crm/${subAccountId}/leads/${appointment.lead_id}`}
                className={btnSecondary}
              >
                View lead
              </Link>
            )}
          </div>

          {/* Job meta */}
          <div className="grid grid-cols-2 gap-3 border-t border-seam pt-4">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-ash">Job #</p>
              <p className="mt-0.5 font-mono text-sm uppercase text-cream">
                {appointment.appointment_id.slice(0, 8)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-ash">Scheduled</p>
              <p className="mt-0.5 text-sm text-cream">
                {slot ? dayLabel(slot.slot_date) : 'Unknown date'}
                {slotWindow ? ` · ${slotWindow.label}` : ''}
              </p>
            </div>
          </div>

          {/* Issue */}
          {lead?.plumbing_issue && (
            <div className="border-t border-seam pt-4">
              <p className="text-xs uppercase tracking-[0.15em] text-ash">Issue</p>
              <p
                className={`mt-1.5 whitespace-pre-line text-sm leading-relaxed text-fog ${
                  issueExpanded ? '' : 'line-clamp-3'
                }`}
              >
                {lead.plumbing_issue}
              </p>
              <button
                type="button"
                onClick={() => setIssueExpanded((v) => !v)}
                className="mt-1 text-xs font-medium text-ember transition-colors hover:text-cream"
              >
                {issueExpanded ? 'Less' : 'More'}
              </button>
            </div>
          )}

          {/* Location */}
          {lead?.customer_address && (
            <div className="border-t border-seam pt-4">
              <p className="text-xs uppercase tracking-[0.15em] text-ash">Location</p>
              <p className="mt-1.5 text-sm leading-relaxed text-cream">
                {lead.customer_address}
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.customer_address)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs font-medium text-ember transition-colors hover:text-cream"
              >
                Get directions
              </a>
            </div>
          )}

          {/* Tags */}
          {lead && (
            <div className="border-t border-seam pt-4">
              <p className="text-xs uppercase tracking-[0.15em] text-ash">Tags</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <EmergencyBadge level={lead.emergency_level} />
                <span className="inline-flex items-center rounded-full bg-soot px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fog ring-1 ring-inset ring-seam">
                  {STAGE_LABEL[lead.pipeline_stage]}
                </span>
              </div>
            </div>
          )}

          {/* Transcript */}
          {lead?.transcript && (
            <div className="border-t border-seam pt-4">
              <details>
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.15em] text-ash transition-colors hover:text-cream">
                  Call transcript
                </summary>
                <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-line rounded-lg bg-soot/50 p-3 text-xs leading-relaxed text-fog">
                  {lead.transcript}
                </p>
              </details>
            </div>
          )}
        </div>

        {/* Cancel */}
        {appointment.status === 'booked' && (
          <div className="border-t border-seam px-5 py-4">
            {cancelError && <p className="mb-2 text-xs text-red-400">{cancelError}</p>}
            <div className="flex items-center justify-end gap-2">
              {confirming ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isCancelling}
                    className={btnDanger}
                  >
                    {isCancelling ? 'Cancelling…' : 'Confirm cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCancelError(null);
                      setConfirming(false);
                    }}
                    disabled={isCancelling}
                    className={btnSecondary}
                  >
                    Keep
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCancelError(null);
                    setConfirming(true);
                  }}
                  className={btnDanger}
                >
                  Cancel appointment
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export default function CalendarPage({
  params,
}: {
  params: Promise<{ sub_account_id: string }>;
}) {
  const { sub_account_id } = use(params);

  const [cursor, setCursor] = useState(() => firstOfMonth(new Date()));
  const [selectedISO, setSelectedISO] = useState(() => toISODate(new Date()));
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [leadDetails, setLeadDetails] = useState<Map<string, LeadDetails>>(new Map());
  const [openAppointmentId, setOpenAppointmentId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /* The grid renders whole weeks, so the fetch range covers the visible
     grid (up to 6 weeks), not just the calendar month. */
  const gridDays = useMemo(() => {
    const first = new Date(cursor);
    first.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(first);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [cursor]);

  /* Pure fetch — no setState (same pattern as the bookings page). Only the
     first load flips isLoading; month changes revalidate silently. */
  const fetchRecords = useCallback(async () => {
    const empty = {
      slots: [] as BookingSlot[],
      appointments: [] as Appointment[],
      leads: new Map<string, LeadDetails>(),
    };
    const slotsRes = await supabase
      .from('booking_slots')
      .select('*')
      .eq('sub_account_id', sub_account_id)
      .gte('slot_date', toISODate(gridDays[0]))
      .lte('slot_date', toISODate(gridDays[gridDays.length - 1]));
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
        .in('slot_id', slots.map((s) => s.slot_id));
      if (apptRes.error) {
        console.error('Failed to load appointments:', apptRes.error.message);
      } else {
        appointments = (apptRes.data ?? []) as Appointment[];
      }
    }

    const leads = new Map<string, LeadDetails>();
    const leadIds = [
      ...new Set(appointments.map((a) => a.lead_id).filter((id): id is string => id !== null)),
    ];
    if (leadIds.length > 0) {
      const leadsRes = await supabase
        .from('plumbing_leads')
        .select('lead_id, email, customer_address, plumbing_issue, emergency_level, pipeline_stage, transcript')
        .in('lead_id', leadIds);
      if (leadsRes.error) {
        console.error('Failed to load linked leads:', leadsRes.error.message);
      } else {
        for (const row of leadsRes.data ?? []) {
          leads.set(row.lead_id as string, row as unknown as LeadDetails);
        }
      }
    }

    return { slots, appointments, leads, error: null as string | null };
  }, [gridDays, sub_account_id]);

  const applyRecords = useCallback(async () => {
    const result = await fetchRecords();
    if (result.error) {
      setLoadError(result.error);
      return;
    }
    setSlots(result.slots);
    setAppointments(result.appointments);
    setLeadDetails(result.leads);
    setLoadError(null);
  }, [fetchRecords]);

  useEffect(() => {
    let isMounted = true;
    fetchRecords().then((result) => {
      if (!isMounted) return;
      if (result.error) {
        setLoadError(result.error);
      } else {
        setSlots(result.slots);
        setAppointments(result.appointments);
        setLeadDetails(result.leads);
        setLoadError(null);
      }
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [fetchRecords]);

  const slotById = useMemo(
    () => new Map(slots.map((s) => [s.slot_id, s])),
    [slots]
  );

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const date = slotById.get(a.slot_id)?.slot_date;
      if (!date) continue;
      const list = map.get(date) ?? [];
      list.push(a);
      map.set(date, list);
    }
    const byWindow = (a: Appointment, b: Appointment) => {
      const wa = WINDOWS.findIndex((w) => w.id === slotById.get(a.slot_id)?.window);
      const wb = WINDOWS.findIndex((w) => w.id === slotById.get(b.slot_id)?.window);
      return wa - wb;
    };
    for (const list of map.values()) list.sort(byWindow);
    return map;
  }, [appointments, slotById]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, BookingSlot[]>();
    for (const s of slots) {
      const list = map.get(s.slot_date) ?? [];
      list.push(s);
      map.set(s.slot_date, list);
    }
    return map;
  }, [slots]);

  const todayISO = toISODate(new Date());
  const selectedAppointments = appointmentsByDate.get(selectedISO) ?? [];

  const openAppointment = appointments.find((a) => a.appointment_id === openAppointmentId) ?? null;

  const shiftMonth = (delta: number) => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl uppercase leading-none tracking-tight text-cream sm:text-4xl">
              Calendar
            </h1>
            <p className="mt-2 text-sm text-fog">
              Every booked appointment by day — click one for the full job card.
            </p>
          </div>
          <span className="rounded-full border border-seam bg-coal px-3 py-1 text-xs font-medium text-fog">
            Account <span className="font-mono">{sub_account_id}</span>
          </span>
        </header>

        {isLoading && (
          <p className="rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
            Loading calendar…
          </p>
        )}

        {!isLoading && loadError && (
          <p className="rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
            Booking isn&apos;t set up for this account yet.
          </p>
        )}

        {!isLoading && !loadError && (
          <>
            {/* Month navigation */}
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl uppercase tracking-tight text-cream">
                {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
              </h2>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => shiftMonth(-1)} className={btnSecondary}>
                  ‹ Prev
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCursor(firstOfMonth(new Date()));
                    setSelectedISO(todayISO);
                  }}
                  className={btnSecondary}
                >
                  Today
                </button>
                <button type="button" onClick={() => shiftMonth(1)} className={btnSecondary}>
                  Next ›
                </button>
              </div>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d) => (
                <p
                  key={d}
                  className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-ash"
                >
                  {d}
                </p>
              ))}
              {gridDays.map((day) => {
                const iso = toISODate(day);
                const inMonth = day.getMonth() === cursor.getMonth();
                const dayAppointments = appointmentsByDate.get(iso) ?? [];
                const daySlots = slotsByDate.get(iso) ?? [];
                const booked = daySlots.reduce((n, s) => n + s.booked_count, 0);
                const capacity = daySlots.reduce((n, s) => n + s.capacity, 0);
                const isToday = iso === todayISO;
                const isSelected = iso === selectedISO;
                return (
                  <div
                    key={iso}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedISO(iso)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedISO(iso);
                    }}
                    className={`flex min-h-20 cursor-pointer flex-col items-stretch gap-1 rounded-lg border p-2 text-left transition-colors sm:min-h-24 ${
                      isSelected
                        ? 'border-ember bg-ember/5'
                        : 'border-seam/60 bg-coal hover:border-fog/40'
                    } ${inMonth ? '' : 'opacity-40'}`}
                  >
                    <span
                      className={`flex items-center justify-between text-xs ${
                        isToday ? 'font-bold text-ember' : 'font-medium text-fog'
                      }`}
                    >
                      <span>{day.getDate()}</span>
                      {capacity > 0 && (
                        <span className="tabular-nums text-[10px] text-ash">
                          {booked}/{capacity}
                        </span>
                      )}
                    </span>
                    {dayAppointments.slice(0, 2).map((a) => {
                      const window = WINDOWS.find(
                        (w) => w.id === slotById.get(a.slot_id)?.window
                      );
                      return (
                        <button
                          key={a.appointment_id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedISO(iso);
                            setOpenAppointmentId(a.appointment_id);
                          }}
                          className="truncate rounded bg-ember/10 px-1.5 py-0.5 text-left text-[10px] font-medium text-ember transition-colors hover:bg-ember/20"
                        >
                          {window?.label} · {a.customer_name}
                        </button>
                      );
                    })}
                    {dayAppointments.length > 2 && (
                      <span className="text-[10px] text-ash">
                        +{dayAppointments.length - 2} more
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected day */}
            <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-[0.15em] text-fog">
              {dayLabel(selectedISO)} · {selectedAppointments.length} booked
            </h2>
            {selectedAppointments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-seam px-4 py-10 text-center text-sm text-fog">
                Nothing booked this day.
              </p>
            ) : (
              <ul className="divide-y divide-seam rounded-xl border border-seam bg-coal">
                {selectedAppointments.map((a) => {
                  const window = WINDOWS.find(
                    (w) => w.id === slotById.get(a.slot_id)?.window
                  );
                  return (
                    <li key={a.appointment_id}>
                      <button
                        type="button"
                        onClick={() => setOpenAppointmentId(a.appointment_id)}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-soot/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-cream">
                            {a.customer_name}
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
                        <span className="shrink-0 text-fog">›</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Job card slide-over */}
      {openAppointment && (
        <JobCard
          appointment={openAppointment}
          slot={slotById.get(openAppointment.slot_id)}
          lead={openAppointment.lead_id ? leadDetails.get(openAppointment.lead_id) : undefined}
          subAccountId={sub_account_id}
          onClose={() => setOpenAppointmentId(null)}
          onCancelled={async () => {
            setOpenAppointmentId(null);
            await applyRecords();
          }}
        />
      )}
    </div>
  );
}
