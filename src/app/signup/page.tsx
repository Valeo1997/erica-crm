'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

// Self-serve account creation. New accounts have no sub_account_users
// membership, so they can't enter the CRM until an admin assigns a business —
// the confirmation state below says so explicitly.
export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/login`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsSubmitting(false);
      return;
    }

    setIsDone(true);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4">
      <div
        className="ember-glow pointer-events-none absolute inset-0"
        aria-hidden="true"
      />

      {isDone ? (
        <div className="relative w-full max-w-sm rounded-2xl border border-seam bg-coal p-8 shadow-2xl shadow-black/50">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ember">
            Ericka · AI Dispatcher
          </p>
          <h1 className="mt-3 font-display text-4xl uppercase leading-[0.95] tracking-tight text-cream">
            Check
            <br />
            your inbox
          </h1>
          <p className="mt-3 text-sm text-fog">
            We sent a confirmation link to{' '}
            <span className="text-cream">{email}</span>. Confirm it, then sign
            in.
          </p>
          <p className="mt-3 text-sm text-ash">
            An admin still needs to assign your business before the CRM opens
            for you — until then, sign-in will say no business is assigned.
          </p>
          <Link
            href="/login"
            className="mt-6 block rounded-lg bg-ember px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-flare"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="relative w-full max-w-sm space-y-4 rounded-2xl border border-seam bg-coal p-8 shadow-2xl shadow-black/50"
        >
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ember">
              Ericka · AI Dispatcher
            </p>
            <h1 className="mt-3 font-display text-4xl uppercase leading-[0.95] tracking-tight text-cream">
              Get Ericka
              <br />
              answering
            </h1>
            <p className="mt-3 text-sm text-fog">
              Create your account. An admin assigns your business before you
              get in.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400 ring-1 ring-inset ring-red-500/30">
              {error}
            </p>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-fog"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-seam bg-ink px-3 py-2 text-sm text-cream placeholder:text-ash focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-fog"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 characters minimum"
              className="w-full rounded-lg border border-seam bg-ink px-3 py-2 text-sm text-cream placeholder:text-ash focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20"
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-1 block text-sm font-medium text-fog"
            >
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-seam bg-ink px-3 py-2 text-sm text-cream placeholder:text-ash focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-flare disabled:opacity-50"
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>

          <Link
            href="/login"
            className="block text-center text-sm text-ash transition-colors hover:text-cream"
          >
            Already have an account? Sign in
          </Link>
        </form>
      )}
    </div>
  );
}
