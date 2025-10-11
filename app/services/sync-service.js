import { getSupabase, getCurrentUser } from './supabaseClient.js';
import dataService from './data.js';
import dbService from './db.js';

function nowIso() { return new Date().toISOString(); }
function slugify(name) { return String(name || '').toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,''); }

async function ensureProfile(supabase, user) {
  if (!user) return;
  await supabase.from('profiles').upsert({ user_id: user.id, email: user.email, created_at: nowIso() }).select();
}

export async function syncAll() {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: 'Supabase not configured' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: 'Not signed in' };
  await ensureProfile(supabase, user);

  const local = await chrome.storage.local.get(['collections', 'userPreferences', 'tabHistory']);
  const collections = local.collections || {};
  const userPreferences = local.userPreferences || {};
  const tabHistory = local.tabHistory || [];
  const spaces = await dataService.getSpaces();

  // Upsert user settings
  if (Object.keys(userPreferences).length) {
    await supabase.from('user_settings').upsert({
      user_id: user.id,
      theme: userPreferences.theme || 'light',
      sync_enabled: userPreferences.syncEnabled !== false,
      auto_save_enabled: userPreferences.autoSaveEnabled !== false,
      updated_at: nowIso(),
    });
  }
  // Push local workspaces to cloud (upsert by name)
  if (Array.isArray(spaces) && spaces.length) {
    for (const s of spaces) {
      const name = s.name || 'Workspace';
      const color = s.color || '#914CE6';
      // Try update existing by name; if not exists, insert
      const { data: wsExisting } = await supabase
        .from('workspaces')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', name)
        .limit(1)
        .maybeSingle();
      if (wsExisting?.id) {
        await supabase.from('workspaces').update({ color, updated_at: nowIso() }).eq('id', wsExisting.id);
      } else {
        await supabase.from('workspaces').insert({ user_id: user.id, name, color, updated_at: nowIso() });
      }
    }
  }



  // Ensure default workspace exists (without relying on unique constraint)
  let personalId = null;
  const { data: existingWs, error: wsErr } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', 'Personal')
    .limit(1)
    .maybeSingle();
  if (existingWs?.id) {
    personalId = existingWs.id;
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('workspaces')
      .insert({ user_id: user.id, name: 'Personal', color: '#ff5c8d', updated_at: nowIso() })
      .select('id')
      .maybeSingle();
    if (!insErr) personalId = inserted?.id || null;
  }

  // Upsert collections and tabs
  const collRows = [];
  const tabRows = [];
  for (const [cid, coll] of Object.entries(collections)) {
    collRows.push({
      id: cid,
      user_id: user.id,
      workspace_id: personalId || null,
      name: coll.name || 'Untitled',
      created_at: coll.createdAt || nowIso(),
      updated_at: coll.updatedAt || nowIso(),
    });
    const tabs = Array.isArray(coll.tabs) ? coll.tabs : [];
    tabs.forEach((t, idx) => {
      tabRows.push({
        user_id: user.id,
        collection_id: cid,
        url: t.url,
        title: t.title || t.url,
        favicon: t.favicon || null,
        order_index: idx,
      });
    });
  }

  if (collRows.length) await supabase.from('collections').upsert(collRows);
  if (tabRows.length) {
    // Replace tabs for these collections: delete then insert to match order
    const collectionIds = [...new Set(tabRows.map(r => r.collection_id))];
    await supabase.from('tabs').delete().in('collection_id', collectionIds);
    await supabase.from('tabs').insert(tabRows);
  }

  // Upsert tab history (append new entries)
  if (tabHistory.length) {
    const historyRows = tabHistory.map(h => ({
      user_id: user.id,
      client_tab_id: String(h.id ?? ''),
      url: h.url,
      title: h.title || h.url,
      favicon: h.favicon || null,
      timestamp: h.timestamp ? new Date(h.timestamp).toISOString() : nowIso(),
    }));
    await supabase.from('tab_history').insert(historyRows);
  }

  return { ok: true };
}

export async function pullAll() {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: 'Supabase not configured' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: 'Not signed in' };

  // Pull workspaces and replace local list with remote
  const { data: remoteWs } = await supabase
    .from('workspaces')
    .select('name,color,updated_at')
    .eq('user_id', user.id)
    .order('name');
  if (Array.isArray(remoteWs)) {
    // Clear existing local spaces
    const existingSpaces = await dataService.getSpaces();
    for (const sp of existingSpaces) {
      await dataService.deleteSpace(sp.id);
    }
    // Add remote spaces locally with stable IDs based on name
    for (const ws of remoteWs) {
      const name = ws.name;
      const color = ws.color || '#914CE6';
      const id = name.toLowerCase() === 'personal' ? 'personal'
        : name.toLowerCase() === 'work' ? 'work'
        : name.toLowerCase() === 'research' ? 'research'
        : slugify(name);
      await dbService.addSpace({ id, name, color, createdAt: Date.now(), updatedAt: Date.now() });
    }
  }

  // Pull collections
  const { data: collRows, error: collErr } = await supabase
    .from('collections')
    .select('id,name,created_at,updated_at')
    .eq('user_id', user.id);
  if (collErr) return { ok: false, reason: collErr.message };

  const collectionIds = (collRows || []).map(c => c.id);
  let tabRows = [];
  if (collectionIds.length) {
    const { data: tabsData } = await supabase
      .from('tabs')
      .select('collection_id,url,title,favicon,order_index')
      .in('collection_id', collectionIds)
      .order('order_index', { ascending: true });
    tabRows = tabsData || [];
  }

  const localCollections = {};
  (collRows || []).forEach(c => {
    const tabs = tabRows
      .filter(t => t.collection_id === c.id)
      .map(t => ({ id: `tab-${Math.random().toString(36).slice(2)}`, url: t.url, title: t.title || t.url, favicon: t.favicon || '' }));
    localCollections[c.id] = {
      id: c.id,
      name: c.name,
      tabs,
      // Default to Personal unless local has other mapping; can be refined later
      workspace: 'personal',
      createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
      updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : Date.now(),
    };
  });
  await chrome.storage.local.set({ collections: localCollections });

  // Pull user settings
  const { data: settings } = await supabase
    .from('user_settings')
    .select('theme,sync_enabled,auto_save_enabled')
    .eq('user_id', user.id)
    .maybeSingle();
  if (settings) {
    const userPreferences = {
      theme: settings.theme || 'light',
      syncEnabled: settings.sync_enabled !== false,
      autoSaveEnabled: settings.auto_save_enabled !== false,
    };
    await chrome.storage.local.set({ userPreferences });
  }

  // Pull tab history (latest 100)
  const { data: historyRows } = await supabase
    .from('tab_history')
    .select('client_tab_id,url,title,favicon,timestamp')
    .eq('user_id', user.id)
    .order('timestamp', { ascending: false })
    .limit(100);
  const tabHistory = (historyRows || []).map(h => ({
    id: h.client_tab_id || '',
    url: h.url,
    title: h.title || h.url,
    favicon: h.favicon || '',
    timestamp: h.timestamp ? new Date(h.timestamp).getTime() : Date.now(),
  }));
  await chrome.storage.local.set({ tabHistory });

  return { ok: true };
}

export function startRealtime() {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  let timer = null;
  const schedulePull = () => {
    if (timer) return;
    timer = setTimeout(async () => {
      try { await pullAll(); } finally { timer = null; }
    }, 500);
  };

  const channel = supabase.channel('simple-tab-sync');
  ['workspaces', 'collections', 'tabs', 'user_settings', 'tab_history'].forEach((table) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, (_payload) => {
      schedulePull();
    });
  });
  channel.subscribe();
  return () => { try { supabase.removeChannel(channel); } catch (_) {} if (timer) { clearTimeout(timer); timer = null; } };
}

export function stopRealtime(dispose) {
  if (typeof dispose === 'function') try { dispose(); } catch (_) {}
}

