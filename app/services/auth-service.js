import { getSupabase } from './supabaseClient.js';

export async function signUp({ email, password }) {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: 'Supabase not configured' } };
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

export async function signIn({ email, password }) {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: 'Supabase not configured' } };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: 'Supabase not configured' } };
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession() {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: { message: 'Supabase not configured' } };
  const { data, error } = await supabase.auth.getSession();
  return { data, error };
}

