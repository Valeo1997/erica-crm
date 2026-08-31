'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

type SessionState = 'loading' | 'ready' | 'invalid';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>('loading');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionState(session ? 'ready' : 'invalid');
    });
  }, []);

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

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setIsSubmitting(false);
      return;
    }

    router.push('/crm');
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
            New
            <br />
            Password
          </h1>
          <p className="mt-3 text-sm text-fog">
            Choose a new password for your account.
          </p>
        </div>

        {sessionState === 'loading' && (
          <p className="text-sm text-fog">Checking your reset link…</p>
        )}

        {sessionState === 'invalid' && (
          <div className="space-y-4">
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400 ring-1 ring-inset ring-red-500/30">
              This reset link is expired or invalid. Request a new one to
              continue.
            </p>
            <Link
              href="/forgot-password"
              className="block text-center text-sm text-ash transition-colors hover:text-cream"
            >
              Request a new reset link
            </Link>
          </div>
        )}

        {sessionState === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400 ring-1 ring-inset ring-red-500/30">
                {error}
              </p>
            )}

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-sm font-medium text-fog"
              >
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                minLength={8}
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
              {isSubmitting ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
