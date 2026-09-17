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
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  title: '',
  company_id: '',
  notes: '',
};
type ContactForm = typeof emptyForm;

function displayName(c: Contact): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed';
}

function initials(c: Contact): string {
  return `${(c.first_name || '')[0] ?? ''}${(c.last_name || '')[0] ?? ''}`.toUpperCase() || '?';
}

export default function ContactsPage({
  params,
}: {
  params: Promise<{ sub_account_id: string }>;
}) {
  const { sub_account_id } = use(params);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /* Pure fetch — no setState, so it can be shared between the mount effect
     (which applies state in a .then callback, matching the pattern used by
     the pipeline/call-logs pages) and post-mutation reloads. */
  const fetchRecords = useCallback(async () => {
    const [contactsRes, companiesRes] = await Promise.all([
      supabase
        .from('contacts')
        .select('*')
        .eq('sub_account_id', sub_account_id)
        .order('first_name', { ascending: true }),
      supabase
        .from('companies')
        .select('*')
        .eq('sub_account_id', sub_account_id)
        .order('name', { ascending: true }),
    ]);
    if (contactsRes.error) {
      console.error('Failed to load contacts:', contactsRes.error.message);
    }
    if (companiesRes.error) {
      console.error('Failed to load companies:', companiesRes.error.message);
    }
    return {
      contacts: (contactsRes.error ? [] : (contactsRes.data ?? [])) as Contact[],
      companies: (companiesRes.error ? [] : (companiesRes.data ?? [])) as Company[],
    };
  }, [sub_account_id]);

  useEffect(() => {
    let isMounted = true;
    fetchRecords().then(({ contacts, companies }) => {
      if (!isMounted) return;
      setContacts(contacts);
      setCompanies(companies);
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [fetchRecords]);

  /* Silent revalidate after a mutation — list stays on screen while it
     refreshes. */
  const reload = async () => {
    const { contacts, companies } = await fetchRecords();
    setContacts(contacts);
    setCompanies(companies);
  };

  const companyById = useMemo(
    () => new Map(companies.map((co) => [co.company_id, co])),
    [companies]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    const digits = q.replace(/\D/g, '');
    return contacts.filter((c) => {
      const haystack = [
        displayName(c),
        c.email,
        c.phone,
        c.title,
        c.company_id ? companyById.get(c.company_id)?.name : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (haystack.includes(q)) return true;
      return (
        digits.length > 0 &&
        (c.phone ?? '').replace(/\D/g, '').includes(digits)
      );
    });
  }, [contacts, query, companyById]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setSaveError(null);
    setConfirmingDelete(false);
    setShowModal(true);
  };

  const openEdit = (contact: Contact) => {
    setEditing(contact);
    setForm({
      first_name: contact.first_name ?? '',
      last_name: contact.last_name ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      title: contact.title ?? '',
      company_id: contact.company_id ?? '',
      notes: contact.notes ?? '',
    });
    setSaveError(null);
    setConfirmingDelete(false);
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      title: form.title.trim() || null,
      company_id: form.company_id || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase
          .from('contacts')
          .update(payload)
          .eq('contact_id', editing.contact_id)
      : await supabase
          .from('contacts')
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
      .from('contacts')
      .delete()
      .eq('contact_id', editing.contact_id);
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
              Contacts
            </h1>
            <p className="mt-2 text-sm text-fog">
              People this account talks to.
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
            Add contact
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
            placeholder="Search name, email, phone, title, or company…"
            aria-label="Search contacts"
            className="w-full rounded-lg border border-seam bg-coal py-2.5 pl-10 pr-4 text-sm text-cream placeholder:text-ash focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20"
          />
        </div>

        {isLoading && (
          <p className="rounded-xl border border-dashed border-seam px-4 py-14 text-center text-sm text-fog">
            Loading contacts…
          </p>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-seam px-4 py-14 text-center">
            <p className="text-sm text-fog">
              {contacts.length === 0
                ? 'No contacts yet for this account.'
                : 'No contacts match your search.'}
            </p>
            {contacts.length === 0 && (
              <button onClick={openAdd} className={`${btnPrimary} mt-4`}>
                Add your first contact
              </button>
            )}
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <ul className="space-y-2">
            {filtered.map((c) => {
              const company = c.company_id ? companyById.get(c.company_id) : undefined;
              const meta = [c.title, company?.name].filter(Boolean).join(' · ');
              return (
                <li key={c.contact_id}>
                  <button
                    onClick={() => openEdit(c)}
                    className="flex w-full items-center gap-3 rounded-xl border border-seam bg-coal p-4 text-left transition-colors hover:border-ash"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-soot text-sm font-semibold text-ember"
                    >
                      {initials(c)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-cream">
                        {displayName(c)}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-fog">
                        {meta || c.email || 'No details yet'}
                      </span>
                    </span>
                    {c.phone && (
                      <span className="hidden shrink-0 font-mono text-xs text-fog sm:block">
                        {c.phone}
                      </span>
                    )}
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
          title={editing ? 'Edit contact' : 'Add contact'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-first-name" className={labelClass}>
                  First name *
                </label>
                <input
                  id="contact-first-name"
                  className={inputClass}
                  placeholder="First name"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="contact-last-name" className={labelClass}>
                  Last name
                </label>
                <input
                  id="contact-last-name"
                  className={inputClass}
                  placeholder="Last name"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-email" className={labelClass}>
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  className={inputClass}
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="contact-phone" className={labelClass}>
                  Phone
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  className={inputClass}
                  placeholder="(555) 123-4567"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-title" className={labelClass}>
                  Title
                </label>
                <input
                  id="contact-title"
                  className={inputClass}
                  placeholder="e.g. Office manager"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="contact-company" className={labelClass}>
                  Company
                </label>
                <select
                  id="contact-company"
                  className={inputClass}
                  value={form.company_id}
                  onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                >
                  <option value="">No company</option>
                  {companies.map((co) => (
                    <option key={co.company_id} value={co.company_id}>
                      {co.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="contact-notes" className={labelClass}>
                Notes
              </label>
              <textarea
                id="contact-notes"
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
                  disabled={isSaving || !form.first_name.trim()}
                  className={`${btnPrimary} flex-1 sm:flex-none`}
                >
                  {isSaving ? 'Saving…' : editing ? 'Save changes' : 'Add contact'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
