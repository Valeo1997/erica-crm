'use client';

import { FormEvent, use, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Company, Contact } from '@/lib/types';
import {
  Modal,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
} from '@/app/crm/components/record-ui';

const emptyForm = {
  name: '',
  industry: '',
  website: '',
  phone: '',
  address: '',
  notes: '',
};
type CompanyForm = typeof emptyForm;

export default function CompaniesPage({
  params,
}: {
  params: Promise<{ sub_account_id: string }>;
}) {
  const { sub_account_id } = use(params);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Pick<Contact, 'contact_id' | 'company_id'>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /* Pure fetch — no setState, so it can be shared between the mount effect
     (which applies state in a .then callback, matching the pattern used by
     the pipeline/call-logs pages) and post-mutation reloads. */
  const fetchRecords = useCallback(async () => {
    const [companiesRes, contactsRes] = await Promise.all([
      supabase
        .from('companies')
        .select('*')
        .eq('sub_account_id', sub_account_id)
        .order('name', { ascending: true }),
      supabase
        .from('contacts')
        .select('contact_id, company_id')
        .eq('sub_account_id', sub_account_id),
    ]);
    if (companiesRes.error) {
      console.error('Failed to load companies:', companiesRes.error.message);
    }
    if (contactsRes.error) {
      console.error('Failed to load contacts:', contactsRes.error.message);
    }
    return {
      companies: (companiesRes.error ? [] : (companiesRes.data ?? [])) as Company[],
      contacts: (contactsRes.error
        ? []
        : (contactsRes.data ?? [])) as Pick<Contact, 'contact_id' | 'company_id'>[],
    };
  }, [sub_account_id]);

  useEffect(() => {
    let isMounted = true;
    fetchRecords().then(({ companies, contacts }) => {
      if (!isMounted) return;
      setCompanies(companies);
      setContacts(contacts);
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [fetchRecords]);

  /* Silent revalidate after a mutation — list stays on screen while it
     refreshes. */
  const reload = async () => {
    const { companies, contacts } = await fetchRecords();
    setCompanies(companies);
    setContacts(contacts);
  };

  const contactCountByCompany = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of contacts) {
      if (!c.company_id) continue;
      counts.set(c.company_id, (counts.get(c.company_id) ?? 0) + 1);
    }
    return counts;
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((co) =>
      [co.name, co.industry, co.website, co.phone, co.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [companies, query]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setSaveError(null);
    setConfirmingDelete(false);
    setShowModal(true);
  };

  const openEdit = (company: Company) => {
    setEditing(company);
    setForm({
      name: company.name ?? '',
      industry: company.industry ?? '',
      website: company.website ?? '',
      phone: company.phone ?? '',
      address: company.address ?? '',
      notes: company.notes ?? '',
    });
    setSaveError(null);
    setConfirmingDelete(false);
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    const payload = {
      name: form.name.trim(),
      industry: form.industry.trim() || null,
      website: form.website.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase
          .from('companies')
          .update(payload)
          .eq('company_id', editing.company_id)
      : await supabase
          .from('companies')
          .insert({ ...payload, sub_account_id });
    setIsSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setShowModal(false);
    await reload();
  };

  const handleDelete = async () => {
    if (!editing || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('company_id', editing.company_id);
    setIsSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setShowModal(false);
    await reload();
  };

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl uppercase leading-none tracking-tight text-cream sm:text-4xl">
              Companies
            </h1>
            <p className="mt-2 text-sm text-fog">
              Businesses this account works with.
            </p>
          </div>
          <button onClick={openAdd} className={btnPrimary}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add company
          </button>
        </header>

        {/* Search */}
        <div className="relative mb-4">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, industry, website, or phone…"
            aria-label="Search companies"
            className="w-full rounded-lg border border-seam bg-coal py-2.5 pl-10 pr-4 text-sm text-cream placeholder:text-ash focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20"
          />
        </div>

        {isLoading && (
          <p className="rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
            Loading companies…
          </p>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-seam px-4 py-14 text-center">
            <p className="text-sm text-fog">
              {companies.length === 0
                ? 'No companies yet for this account.'
                : 'No companies match your search.'}
            </p>
            {companies.length === 0 && (
              <button onClick={openAdd} className={`${btnPrimary} mt-4`}>
                Add your first company
              </button>
            )}
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <ul className="space-y-2">
            {filtered.map((co) => {
              const contactCount = contactCountByCompany.get(co.company_id) ?? 0;
              const meta = [co.industry, co.website].filter(Boolean).join(' · ');
              return (
                <li key={co.company_id}>
                  <button
                    onClick={() => openEdit(co)}
                    className="flex w-full items-center gap-3 rounded-xl border border-seam bg-coal p-4 text-left transition-colors hover:border-ash"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-soot font-display text-lg text-ember"
                    >
                      {(co.name || '?')[0].toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-cream">
                        {co.name}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-fog">
                        {meta || co.address || 'No details yet'}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-soot px-2.5 py-1 text-xs font-medium tabular-nums text-fog">
                      {contactCount} contact{contactCount === 1 ? '' : 's'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-3 text-xs text-ash">
          Account <span className="font-mono">{sub_account_id}</span>
        </p>
      </div>

      {showModal && (
        <Modal
          title={editing ? 'Edit company' : 'Add company'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="company-name" className={labelClass}>
                Name *
              </label>
              <input
                id="company-name"
                className={inputClass}
                placeholder="Company name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="company-industry" className={labelClass}>
                  Industry
                </label>
                <input
                  id="company-industry"
                  className={inputClass}
                  placeholder="e.g. Property management"
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="company-website" className={labelClass}>
                  Website
                </label>
                <input
                  id="company-website"
                  className={inputClass}
                  placeholder="www.example.com"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="company-phone" className={labelClass}>
                  Phone
                </label>
                <input
                  id="company-phone"
                  type="tel"
                  className={inputClass}
                  placeholder="(555) 123-4567"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="company-address" className={labelClass}>
                  Address
                </label>
                <input
                  id="company-address"
                  className={inputClass}
                  placeholder="Street, city, state"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label htmlFor="company-notes" className={labelClass}>
                Notes
              </label>
              <textarea
                id="company-notes"
                rows={3}
                className={inputClass}
                placeholder="Anything worth remembering…"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {saveError && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {saveError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                {editing &&
                  (confirmingDelete ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isSaving}
                        className={btnDanger}
                      >
                        Confirm delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(false)}
                        disabled={isSaving}
                        className={btnSecondary}
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      disabled={isSaving}
                      className={btnDanger}
                    >
                      Delete
                    </button>
                  ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={isSaving}
                  className={`${btnSecondary} flex-1 sm:flex-none`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !form.name.trim()}
                  className={`${btnPrimary} flex-1 sm:flex-none`}
                >
                  {isSaving ? 'Saving…' : editing ? 'Save changes' : 'Add company'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
