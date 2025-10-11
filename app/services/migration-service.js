import { getSupabase, getCurrentUser } from './supabaseClient.js';
import { syncAll } from './sync-service.js';

export async function migrateLocalToCloud() {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: 'Supabase not configured' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: 'Not signed in' };

  // For now, reuse syncAll as initial migration path
  return await syncAll();
}

