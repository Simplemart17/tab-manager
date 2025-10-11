// Supabase configuration for Simple Tab Plus
// Project: Simple Tab (ref: anoylxzjeatvusegpzmy)

export const SUPABASE_URL = 'https://anoylxzjeatvusegpzmy.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFub3lseHpqZWF0dnVzZWdwem15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwOTMzMTIsImV4cCI6MjA3NTY2OTMxMn0.oHzO1HxyJuwL3V39OUwCUp1A13cxai3wp4GHG5qxAqg';

export function hasValidSupabaseConfig() {
  return (
    typeof SUPABASE_URL === 'string' && SUPABASE_URL.startsWith('https://') &&
    typeof SUPABASE_ANON_KEY === 'string' && SUPABASE_ANON_KEY.length > 0
  );
}

