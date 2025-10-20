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
  
  try {
    const { data, error } = await supabase.auth.getSession();
    
    // If session is null but no error, try to refresh
    if (!data?.session && !error) {
      console.log('No session found, attempting to refresh...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshData?.session) {
        console.log('Session refreshed successfully');
        return { data: refreshData, error: null };
      }
      if (refreshError) {
        console.log('Session refresh failed:', refreshError.message);
      }
    }
    
    return { data, error };
  } catch (error) {
    console.error('Session check failed:', error);
    return { data: null, error };
  }
}

// Add a robust session validation function
export async function validateSession(retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const { data, error } = await getSession();
      
      if (data?.session?.user) {
        return { valid: true, session: data.session, user: data.session.user };
      }
      
      if (error) {
        console.warn(`Session validation attempt ${i + 1} failed:`, error.message);
        if (i < retries - 1) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
      
      return { valid: false, session: null, user: null, error };
    } catch (error) {
      console.error(`Session validation attempt ${i + 1} error:`, error);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      return { valid: false, session: null, user: null, error };
    }
  }
  
  return { valid: false, session: null, user: null };
}

