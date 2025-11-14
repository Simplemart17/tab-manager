import { getSupabase, getCurrentUser } from './supabaseClient.js';
import dataService from './data.js';
import dbService from './db.js';

function nowIso() { return new Date().toISOString(); }
function slugify(name) { return String(name || '').toLowerCase().trim().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,''); }

// Global flag to disable sync operations
let SYNC_DISABLED = false;

// Helper function to toggle sync mode
export function toggleSyncMode() {
  SYNC_DISABLED = !SYNC_DISABLED;
  console.log(`Sync ${SYNC_DISABLED ? 'DISABLED' : 'ENABLED'}`);
  return !SYNC_DISABLED;
}

// Sync lock to prevent pullAll from running during syncAll
let isSyncing = false;

async function ensureProfile(supabase, user) {
  if (!user) return;
  await supabase.from('profiles').upsert({ user_id: user.id, email: user.email, created_at: nowIso() }).select();
}

export async function syncAll() {
  if (SYNC_DISABLED) {
    console.log('SYNC DISABLED - syncAll skipped');
    return { ok: true, skipped: true, reason: 'Sync disabled' };
  }
  
  // Set sync lock
  isSyncing = true;
  try {
    return await _syncAllImpl();
  } finally {
    // Release sync lock
    isSyncing = false;
  }
}

async function _syncAllImpl() {
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

  // Upsert collections and tabs (prefer IndexedDB; fallback to chrome.storage.local)
  let idbCollections = await dataService.getCollections();
  if (!idbCollections || idbCollections.length === 0) {
    const local = await chrome.storage.local.get(['collections']);
    const localObj = local.collections || {};
    idbCollections = Object.values(localObj);
  }

  // Build a map of workspace name -> id for current user
  const { data: wsList } = await supabase
    .from('workspaces')
    .select('id,name')
    .eq('user_id', user.id);
  const wsIdByName = Object.fromEntries((wsList || []).map(w => [String(w.name), w.id]));

  for (const coll of (idbCollections || [])) {
    const localCid = coll.id;
    // Determine workspace name from the collection's spaceId
    let wsName = null;
    let wsId = null;

    if (coll.spaceId) {
      const space = (spaces || []).find(s => s.id === coll.spaceId);
      if (space) {
        wsName = space.name;
        wsId = wsIdByName[wsName] || null;
      }
    }

    // If no workspace found, skip this collection (it has an invalid spaceId)
    if (!wsId) {
      console.warn(`Collection "${coll.name}" has invalid spaceId "${coll.spaceId}", skipping sync`);
      continue;
    }

    const baseRow = {
      user_id: user.id,
      workspace_id: wsId,
      name: coll.name || 'Untitled',
      created_at: coll.createdAt ? new Date(coll.createdAt).toISOString() : nowIso(),
      updated_at: coll.updatedAt ? new Date(coll.updatedAt).toISOString() : nowIso(),
    };

    let remoteCollId = null;
    // Always use upsert with the local ID to ensure collections are synced properly
    const { data, error } = await supabase
      .from('collections')
      .upsert({ id: localCid, ...baseRow })
      .select('id')
      .maybeSingle();
    if (error) throw new Error(`Collections upsert failed: ${error.message}`);
    remoteCollId = data?.id || localCid;

    // Replace tabs for this collection id
    const tabs = Array.isArray(coll.tabs) ? coll.tabs : [];
    const { error: delErr } = await supabase
      .from('tabs')
      .delete()
      .eq('collection_id', remoteCollId);
    if (delErr) throw new Error(`Tabs delete failed: ${delErr.message}`);

    if (tabs.length) {
      const rows = tabs.map((t, idx) => ({
        user_id: user.id,
        collection_id: remoteCollId,
        url: t.url,
        title: t.title || t.url,
        favicon: t.favicon || null,
        order_index: idx,
      }));
      const { error: insErr } = await supabase.from('tabs').insert(rows);
      if (insErr) throw new Error(`Tabs insert failed: ${insErr.message}`);
    }
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
    const { error: histErr } = await supabase.from('tab_history').insert(historyRows);
    if (histErr) throw new Error(`History insert failed: ${histErr.message}`);
  }

  // Delete collections from Supabase that no longer exist locally
  const localCollectionIds = new Set((idbCollections || []).map(c => c.id));
  const { data: remoteCollections } = await supabase
    .from('collections')
    .select('id')
    .eq('user_id', user.id);

  if (remoteCollections && remoteCollections.length > 0) {
    const collectionsToDelete = remoteCollections
      .filter(rc => !localCollectionIds.has(rc.id))
      .map(rc => rc.id);

    if (collectionsToDelete.length > 0) {
      // Delete tabs first (foreign key constraint)
      await supabase
        .from('tabs')
        .delete()
        .in('collection_id', collectionsToDelete);

      // Then delete collections
      await supabase
        .from('collections')
        .delete()
        .in('id', collectionsToDelete);
    }
  }

  // Delete workspaces from Supabase that no longer exist locally
  const localSpaceNames = new Set((spaces || []).map(s => s.name));
  const { data: remoteWorkspaces } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('user_id', user.id);

  if (remoteWorkspaces && remoteWorkspaces.length > 0) {
    const workspacesToDelete = remoteWorkspaces
      .filter(rw => !localSpaceNames.has(rw.name))
      .map(rw => rw.id);

    if (workspacesToDelete.length > 0) {
      // Get collections in these workspaces
      const { data: collectionsInWorkspaces } = await supabase
        .from('collections')
        .select('id')
        .in('workspace_id', workspacesToDelete);

      if (collectionsInWorkspaces && collectionsInWorkspaces.length > 0) {
        const collectionIds = collectionsInWorkspaces.map(c => c.id);

        // Delete tabs first
        await supabase
          .from('tabs')
          .delete()
          .in('collection_id', collectionIds);

        // Delete collections
        await supabase
          .from('collections')
          .delete()
          .in('workspace_id', workspacesToDelete);
      }

      // Finally delete workspaces
      await supabase
        .from('workspaces')
        .delete()
        .in('id', workspacesToDelete);
    }
  }

  return { ok: true };
}

export async function pullAll() {
  if (SYNC_DISABLED) {
    console.log('SYNC DISABLED - pullAll skipped');
    return { ok: true, skipped: true, reason: 'Sync disabled' };
  }
  
  // Don't pull if sync is in progress to avoid race conditions
  if (isSyncing) {
    return { ok: true, skipped: true };
  }

  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: 'Supabase not configured' };
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: 'Not signed in' };

  // Pull workspaces and merge with local spaces
  const { data: remoteWs } = await supabase
    .from('workspaces')
    .select('id,name,color,updated_at')
    .eq('user_id', user.id)
    .order('name');

  // Build a map from remote workspace id -> local space id
  const wsIdToLocalSpaceId = {};

  if (Array.isArray(remoteWs) && remoteWs.length > 0) {
    const existingSpaces = await dataService.getSpaces();
    const existingSpacesMap = {};
    for (const sp of existingSpaces) {
      existingSpacesMap[sp.name] = sp;
    }

    // Merge remote spaces with local spaces
    for (const ws of remoteWs) {
      const name = ws.name;
      const color = ws.color || '#914CE6';
      const localId = slugify(name);

      wsIdToLocalSpaceId[ws.id] = localId;

      const existingSpace = existingSpacesMap[name];
      if (existingSpace) {
        // Update existing space if remote is newer or if color changed
        const remoteUpdatedAt = ws.updated_at ? new Date(ws.updated_at).getTime() : 0;
        const localUpdatedAt = existingSpace.updatedAt || 0;

        if (remoteUpdatedAt >= localUpdatedAt || existingSpace.color !== color) {
          await dbService.updateSpace({
            ...existingSpace,
            color,
            updatedAt: Date.now()
          });
        }
      } else {
        // Add new space from remote
        await dbService.addSpace({
          id: localId,
          name,
          color,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
    }
  }

  // Pull collections (include workspace_id)
  const { data: collRows, error: collErr } = await supabase
    .from('collections')
    .select('id,name,workspace_id,created_at,updated_at')
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

  // Merge remote collections with local collections instead of replacing
  const existingCollections = await dbService.getCollections();
  const existingCollectionsMap = {};
  for (const ec of existingCollections) {
    existingCollectionsMap[ec.id] = ec;
  }

  // Track which remote collections we've processed
  const processedRemoteIds = new Set();

  for (const c of (collRows || [])) {
    processedRemoteIds.add(c.id);

    const tabs = tabRows
      .filter(t => t.collection_id === c.id)
      .map(t => ({
        id: `tab-${Math.random().toString(36).slice(2)}`,
        url: t.url,
        title: t.title || t.url,
        favicon: t.favicon || ''
      }));

    const spaceId = wsIdToLocalSpaceId[c.workspace_id];
    const remoteUpdatedAt = c.updated_at ? new Date(c.updated_at).getTime() : Date.now();

    const existingCollection = existingCollectionsMap[c.id];

    if (existingCollection) {
      // Collection exists locally - update only if remote is newer
      const localUpdatedAt = existingCollection.updatedAt || 0;

      if (remoteUpdatedAt >= localUpdatedAt) {
        const coll = {
          id: c.id,
          name: c.name,
          spaceId,
          tabs,
          createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
          updatedAt: remoteUpdatedAt,
        };
        await dbService.updateCollection(coll);
      }
      // If local is newer, keep local version (it will be synced on next syncAll)
    } else {
      // Collection doesn't exist locally - add it
      const coll = {
        id: c.id,
        name: c.name,
        spaceId,
        tabs,
        createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
        updatedAt: remoteUpdatedAt,
      };
      await dbService.addCollection(coll);
    }
  }

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

/**
 * Bidirectional sync: Push local changes to cloud, then pull remote changes to local
 * This ensures both local and cloud are in sync
 */
export async function bidirectionalSync() {
  if (SYNC_DISABLED) {
    console.log('SYNC DISABLED - bidirectionalSync skipped');
    return { ok: true, skipped: true, reason: 'Sync disabled' };
  }

  try {
    // First push local changes to cloud
    const pushResult = await syncAll();
    if (!pushResult.ok) {
      return pushResult;
    }

    // Then pull remote changes to local
    const pullResult = await pullAll();
    return pullResult;
  } catch (error) {
    console.error('Bidirectional sync failed:', error);
    return { ok: false, reason: error.message };
  }
}

export function startRealtime() {
  if (SYNC_DISABLED) {
    console.log('SYNC DISABLED - startRealtime skipped');
    return () => {};
  }

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

