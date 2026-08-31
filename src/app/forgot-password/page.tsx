'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
      }
    );

    setIsSubmitting(false);

    if (resetError) {
      // Only surface genuine failures — never reveal whether the account exists.
      setError('Something went wrong sending the reset email. Please try again.');
      return;
    }

    setIsSubmitted(true);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4">
      <div
        className="ember-glow pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-seam bg-coal p-8 shadow-2xl shadow-black/50">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ember">
            Ericka · AI Dispatcher
          </p>
          <h1 className="mt-3 font-display text-4xl uppercase leading-[0.95] tracking-tight text-cream">
            Reset
            <br />
            Password
          </h1>
          <p className="mt-3 text-sm text-fog">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {isSubmitted ? (
          <div className="space-y-4">
            <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400 ring-1 ring-inset ring-emerald-500/30">
              If an account exists for that email, a reset link is on its way.
            </p>
            <Link
              href="/login"
              className="block text-center text-sm text-ash transition-colors hover:text-cream"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-flare disabled:opacity-50"
            >
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </button>

            <Link
              href="/login"
              className="block text-center text-sm text-ash transition-colors hover:text-cream"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
