'use client';

import Link from 'next/link';
import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Appointment, BookingSlot, Lead } from '@/lib/types';
import {
  Modal,
  STAGE_DISPLAY,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
} from '@/app/crm/components/record-ui';

const WINDOWS: { id: BookingSlot['window']; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'midday', label: 'Midday' },
  { id: 'late_afternoon', label: 'Late afternoon' },
];

const EMERGENCY_LEVELS = ['standard', 'routine', 'urgent', 'emergency'];

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${hour12}:${minutes} ${ampm}`;
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const EMERGENCY_STYLES: Record<string, string> = {
  emergency: 'bg-red-500/15 text-red-400 ring-red-500/40',
  urgent: 'bg-ember/15 text-ember ring-ember/40',
  routine: 'bg-soot text-fog ring-seam',
  standard: 'bg-soot text-fog ring-seam',
};
const EMERGENCY_FALLBACK = 'bg-soot text-fog ring-seam';

function EmergencyBadge({ level }: { level: Lead['emergency_level'] }) {
  const classes = EMERGENCY_STYLES[level.toLowerCase()] ?? EMERGENCY_FALLBACK;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${classes}`}
    >
      {level}
    </span>
  );
}

const STATUS_STYLES: Record<Appointment['status'], string> = {
  booked: 'bg-ember/10 text-ember ring-ember/40',
  completed: 'bg-flare/10 text-flare ring-flare/40',
  cancelled: 'bg-soot text-ash ring-seam',
  no_show: 'bg-red-500/15 text-red-400 ring-red-500/40',
};

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ash">{label}</p>
      <p className={`mt-1 text-sm text-cream ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
}

type EditForm = {
  customer_name: string;
  customer_phone: string;
  email: string;
  customer_address: string;
  plumbing_issue: string;
  emergency_level: string;
  pipeline_stage: Lead['pipeline_stage'];
};

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ sub_account_id: string; lead_id: string }>;
}) {
  const { sub_account_id, lead_id } = use(params);
  const crmBase = `/crm/${sub_account_id}`;

  const [lead, setLead] = useState<Lead | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [slotById, setSlotById] = useState<Map<string, BookingSlot>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  /* Pure fetch — no setState, shared between the mount effect and
     post-mutation reloads (same pattern as the contacts page). */
  const fetchRecords = useCallback(async () => {
    const empty = {
      lead: null,
      appointments: [] as Appointment[],
      slots: new Map<string, BookingSlot>(),
      missing: true,
    };
    const leadRes = await supabase
      .from('plumbing_leads')
      .select('*')
      .eq('lead_id', lead_id)
      .eq('sub_account_id', sub_account_id)
      .maybeSingle();
    if (leadRes.error) {
      console.error('Failed to load lead:', leadRes.error.message);
      return empty;
    }
    if (!leadRes.data) {
      return empty;
    }

    const apptRes = await supabase
      .from('appointments')
      .select('*')
      .eq('lead_id', lead_id)
      .order('created_at', { ascending: false });
    if (apptRes.error) {
      console.error('Failed to load appointments:', apptRes.error.message);
    }
    const appointments = (apptRes.data ?? []) as Appointment[];

    const slots = new Map<string, BookingSlot>();
    const slotIds = [...new Set(appointments.map((a) => a.slot_id))];
    if (slotIds.length > 0) {
      const slotsRes = await supabase
        .from('booking_slots')
        .select('*')
        .in('slot_id', slotIds);
      if (slotsRes.error) {
        console.error('Failed to load booking slots:', slotsRes.error.message);
      } else {
        for (const row of slotsRes.data ?? []) {
          const slot = row as BookingSlot;
          slots.set(slot.slot_id, slot);
        }
      }
    }

    return { lead: leadRes.data as Lead, appointments, slots, missing: false };
  }, [sub_account_id, lead_id]);

  useEffect(() => {
    let isMounted = true;
    fetchRecords().then((result) => {
      if (!isMounted) return;
      setLead(result.lead);
      setAppointments(result.appointments);
      setSlotById(result.slots);
      setNotFound(result.missing);
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [fetchRecords]);

  /* Silent revalidate after a mutation. */
  const reload = async () => {
    const result = await fetchRecords();
    setLead(result.lead);
    setAppointments(result.appointments);
    setSlotById(result.slots);
  };

  const openEdit = () => {
    if (!lead) return;
    setForm({
      customer_name: lead.customer_name,
      customer_phone: lead.customer_phone,
      email: lead.email ?? '',
      customer_address: lead.customer_address,
      plumbing_issue: lead.plumbing_issue,
      emergency_level: lead.emergency_level,
      pipeline_stage: lead.pipeline_stage,
    });
    setSaveError(null);
    setShowEdit(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!lead || !form || !form.customer_name.trim() || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    const { error } = await supabase
      .from('plumbing_leads')
      .update({
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        email: form.email.trim() || null,
        customer_address: form.customer_address.trim(),
        plumbing_issue: form.plumbing_issue.trim(),
        emergency_level: form.emergency_level,
        pipeline_stage: form.pipeline_stage,
      })
      .eq('lead_id', lead.lead_id);
    setIsSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setShowEdit(false);
    await reload();
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    if (cancellingId) return;
    setCancellingId(appointmentId);
    setCancelError(null);
    const { data, error } = await supabase.rpc('cancel_appointment', {
      p_appointment_id: appointmentId,
    });
    setCancellingId(null);
    setConfirmCancelId(null);
    if (error) {
      setCancelError(error.message);
      return;
    }
    if (data !== true) {
      setCancelError('Could not cancel that appointment.');
      return;
    }
    await reload();
  };

  const stageDisplay = lead
    ? STAGE_DISPLAY.find((s) => s.stage === lead.pipeline_stage)
    : undefined;

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={`${crmBase}/pipeline`}
          className="inline-flex items-center gap-1.5 text-sm text-fog transition-colors hover:text-cream"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Pipeline
        </Link>

        {isLoading && (
          <p className="mt-6 rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
            Loading lead…
          </p>
        )}

        {!isLoading && notFound && (
          <p className="mt-6 rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
            This lead doesn&apos;t exist for this account.
          </p>
        )}

        {!isLoading && lead && (
          <>
            <header className="mt-4 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl uppercase leading-none tracking-tight text-cream sm:text-4xl">
                {lead.customer_name}
              </h1>
              {stageDisplay && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-seam bg-coal px-2.5 py-1 text-xs font-medium text-fog">
                  <span className={`h-1.5 w-1.5 rounded-full ${stageDisplay.dot}`} />
                  {stageDisplay.label}
                </span>
              )}
              <EmergencyBadge level={lead.emergency_level} />
              <button onClick={openEdit} className={`${btnSecondary} ml-auto`}>
                Edit lead
              </button>
            </header>

            <section className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-seam bg-coal p-5 sm:grid-cols-3">
              <Field label="Phone" value={lead.customer_phone} mono />
              <Field label="Email" value={lead.email ?? ''} />
              <Field label="Address" value={lead.customer_address} />
              <Field label="Call time" value={formatTimestamp(lead.created_at)} />
              <Field label="Call ID" value={lead.call_id} mono />
            </section>

            <section className="mt-4 rounded-xl border border-seam bg-coal p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ash">
                The issue
              </p>
              <p className="mt-2 text-[15px] leading-7 text-cream/90">{lead.plumbing_issue}</p>
            </section>

            {appointments.length > 0 && (
              <section className="mt-4 rounded-xl border border-seam bg-coal">
                <div className="border-b border-seam px-5 py-3">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-ember">
                    Appointments
                  </h2>
                </div>
                <ul className="divide-y divide-seam">
                  {appointments.map((a) => {
                    const slot = slotById.get(a.slot_id);
                    const window = WINDOWS.find((w) => w.id === slot?.window);
                    return (
                      <li key={a.appointment_id} className="flex items-center gap-3 px-5 py-3.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-cream">
                            {slot ? dayLabel(slot.slot_date) : 'Unknown date'}
                            {window && (
                              <span className="font-normal text-fog"> · {window.label}</span>
                            )}
                          </p>
                          {a.notes && <p className="mt-0.5 text-xs text-fog">{a.notes}</p>}
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STATUS_STYLES[a.status] ?? STATUS_STYLES.cancelled}`}
                        >
                          {a.status}
                        </span>
                        {a.status === 'booked' &&
                          (confirmCancelId === a.appointment_id ? (
                            <span className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleCancelAppointment(a.appointment_id)}
                                disabled={cancellingId === a.appointment_id}
                                className={btnDanger}
                              >
                                {cancellingId === a.appointment_id ? 'Cancelling…' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmCancelId(null)}
                                disabled={cancellingId === a.appointment_id}
                                className={btnSecondary}
                              >
                                Keep
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelError(null);
                                setConfirmCancelId(a.appointment_id);
                              }}
                              className={`${btnDanger} shrink-0`}
                            >
                              Cancel
                            </button>
                          ))}
                      </li>
                    );
                  })}
                </ul>
                {cancelError && (
                  <p className="border-t border-seam px-5 py-3 text-sm text-red-400">
                    {cancelError}
                  </p>
                )}
              </section>
            )}

            <section className="mt-4 rounded-xl border border-seam bg-coal p-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ember">
                Transcript
              </p>
              {lead.transcript ? (
                <p className="whitespace-pre-line text-[15px] leading-7 text-cream/90">
                  {lead.transcript}
                </p>
              ) : (
                <p className="text-sm italic text-ash">No transcript recorded for this call.</p>
              )}
            </section>
          </>
        )}
      </div>

      {showEdit && form && (
        <Modal title="Edit lead" onClose={() => setShowEdit(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="lead-name" className={labelClass}>
                Customer name *
              </label>
              <input
                id="lead-name"
                className={inputClass}
                placeholder="Full name"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lead-phone" className={labelClass}>
                  Phone
                </label>
                <input
                  id="lead-phone"
                  type="tel"
                  className={inputClass}
                  placeholder="(555) 123-4567"
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="lead-email" className={labelClass}>
                  Email
                </label>
                <input
                  id="lead-email"
                  type="email"
                  className={inputClass}
                  placeholder="customer@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="lead-stage" className={labelClass}>
                  Pipeline stage
                </label>
                <select
                  id="lead-stage"
                  className={inputClass}
                  value={form.pipeline_stage}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      pipeline_stage: e.target.value as Lead['pipeline_stage'],
                    })
                  }
                >
                  {STAGE_DISPLAY.map((s) => (
                    <option key={s.stage} value={s.stage}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="lead-address" className={labelClass}>
                Address
              </label>
              <input
                id="lead-address"
                className={inputClass}
                placeholder="Service address"
                value={form.customer_address}
                onChange={(e) => setForm({ ...form, customer_address: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="lead-issue" className={labelClass}>
                The issue
              </label>
              <textarea
                id="lead-issue"
                rows={3}
                className={inputClass}
                placeholder="What the customer reported…"
                value={form.plumbing_issue}
                onChange={(e) => setForm({ ...form, plumbing_issue: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="lead-emergency" className={labelClass}>
                Urgency
              </label>
              <select
                id="lead-emergency"
                className={inputClass}
                value={form.emergency_level}
                onChange={(e) => setForm({ ...form, emergency_level: e.target.value })}
              >
                {EMERGENCY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            {saveError && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {saveError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                disabled={isSaving}
                className={btnSecondary}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !form.customer_name.trim()}
                className={btnPrimary}
              >
                {isSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
