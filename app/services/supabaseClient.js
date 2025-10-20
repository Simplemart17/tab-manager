import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, hasValidSupabaseConfig } from '../config/supabase-config.js';

let _client = null;

export function getSupabase() {
  if (!hasValidSupabaseConfig()) return null;
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        // Chrome extension specific storage configuration
        storage: {
          getItem: async (key) => {
            try {
              const result = await chrome.storage.local.get([key]);
              return result[key] || null;
            } catch (error) {
              console.warn('Failed to get item from storage:', error);
              return null;
            }
          },
          setItem: async (key, value) => {
            try {
              await chrome.storage.local.set({ [key]: value });
            } catch (error) {
              console.warn('Failed to set item in storage:', error);
            }
          },
          removeItem: async (key) => {
            try {
              await chrome.storage.local.remove([key]);
            } catch (error) {
              console.warn('Failed to remove item from storage:', error);
            }
          }
        },
        // Increase session refresh threshold for better persistence
        sessionRefreshThreshold: 300, // 5 minutes before expiry
      },
    });
  }
  return _client;
}

export async function getCurrentUser() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

