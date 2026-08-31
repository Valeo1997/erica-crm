'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !signInData.user) {
      setError(signInError?.message ?? 'Login failed.');
      setIsSubmitting(false);
      return;
    }

    const isAdmin = signInData.user.app_metadata?.is_admin === true;

    if (isAdmin) {
      router.push('/crm');
      return;
    }

    const { data: membership, error: membershipError } = await supabase
      .from('sub_account_users')
      .select('sub_account_id')
      .eq('user_id', signInData.user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership) {
      setError('Your account has no assigned business. Contact support.');
      setIsSubmitting(false);
      return;
    }

    router.push(`/crm/${membership.sub_account_id}/pipeline`);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink px-4">
      <div
        className="ember-glow pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm space-y-4 rounded-2xl border border-seam bg-coal p-8 shadow-2xl shadow-black/50"
      >
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ember">
            Ericka · AI Dispatcher
          </p>
          <h1 className="mt-3 font-display text-4xl uppercase leading-[0.95] tracking-tight text-cream">
            Command
            <br />
            Center
          </h1>
          <p className="mt-3 text-sm text-fog">
            Sign in to see what Ericka handled overnight.
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
            className="w-full rounded-lg border border-seam bg-ink px-3 py-2 text-sm text-cream placeholder:text-ash focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-flare disabled:opacity-50"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
