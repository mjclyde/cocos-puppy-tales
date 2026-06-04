import type { SupabaseClient } from '@supabase/supabase-js';
import type { WaitlistStatus } from './entry-input';

export interface WaitlistEntry {
  id: string;
  created_at: string;
  name: string;
  email: string;
  phone: string | null;
  location: string;
  about: string;
  preferences: string | null;
  read_expectations: boolean;
  source: string | null;
  status: WaitlistStatus;
  notes: string | null;
}

/** All waitlist entries, newest first. */
export async function fetchWaitlistEntries(client: SupabaseClient): Promise<WaitlistEntry[]> {
  const { data, error } = await client
    .from('waitlist')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WaitlistEntry[];
}

/** Update one entry's status and/or notes. */
export async function updateWaitlistEntry(
  client: SupabaseClient,
  id: string,
  patch: { status?: WaitlistStatus; notes?: string },
): Promise<void> {
  const { error } = await client.from('waitlist').update(patch).eq('id', id);
  if (error) throw error;
}
