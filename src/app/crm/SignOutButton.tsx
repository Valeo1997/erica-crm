'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded-md border border-seam px-3 py-1.5 text-xs font-medium text-fog transition-colors hover:border-ember/50 hover:text-cream"
    >
      Sign out
    </button>
  );
}
