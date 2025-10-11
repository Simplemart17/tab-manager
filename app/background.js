// Background script for Tab Manager
import { syncAll, pullAll, startRealtime, stopRealtime } from './services/sync-service.js';
import { signUp, signIn, signOut, getSession } from './services/auth-service.js';
import { migrateLocalToCloud } from './services/migration-service.js';
const SYNC_INTERVAL = 30000; // 30 seconds
let realtimeDispose = null;

// Check if extension context is valid
const isExtensionContextValid = () => {
  try {
    chrome.runtime.getURL('');
    return true;
  } catch (e) {
    return false;
  }
};

// Wrapper for Chrome API calls
const safeApiCall = async (apiCall) => {
  if (!isExtensionContextValid()) {
    throw new Error('Extension context invalidated');
  }
  try {
    return await apiCall();
  } catch (e) {
    console.error('Chrome API call failed:', e);
    throw e;
  }
};

// Tab management state
let collections = {};
let syncedTabs = {};
let userPreferences = {
  theme: 'light',
  syncEnabled: true,
  autoSaveEnabled: true
};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  // Load stored data if available
  chrome.storage.local.get(['collections', 'userPreferences'], (result) => {
    if (result.collections) {
      collections = result.collections;
    }

    if (result.userPreferences) {
      userPreferences = result.userPreferences;
    } else {
      // Save default preferences
      chrome.storage.local.set({ userPreferences });
    }
  });

  // Create context menu for adding tabs to collections
  chrome.contextMenus.create({
    id: 'add-to-collection',
    title: 'Add to Collection',
    contexts: ['page', 'link']
  });

  // Setup alarm for syncing
  chrome.alarms.create('syncTabs', {
    periodInMinutes: SYNC_INTERVAL / 60000
  });
});

// Function to get favicon URL safely
const getFaviconUrl = (url) => {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch (e) {
    return chrome.runtime.getURL('app/assets/icons/icon16.png');
  }
};

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && userPreferences.autoSaveEnabled) {
    // Update tab with safe favicon URL
    const faviconUrl = getFaviconUrl(tab.url);
    tab.favIconUrl = faviconUrl;
    saveTabToHistory(tab);
  }
});

// Listen for tab removals
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  handleTabRemoval(tabId);
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'add-to-collection') {
    // Open popup for collection selection
    chrome.runtime.sendMessage({
      action: 'openCollectionSelector',
      tab: tab
    });
  }
});

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!isExtensionContextValid()) {
    sendResponse({ error: 'Extension context invalidated' });
    return;
  }

  const handleError = (error) => {
    console.error('Operation failed:', error);
    sendResponse({ error: error.message || 'Operation failed' });
  };

  try {
    switch (request.action) {
      case 'getCollections':
        sendResponse({ collections });
        break;

      case 'saveCollection':
        safeApiCall(async () => {
          await saveCollection(request.collection);
          sendResponse({ success: true });
        }).catch(handleError);
        return true;

      case 'getTabs':
        safeApiCall(async () => {
          const tabs = await chrome.tabs.query({});
          sendResponse({ tabs });
        }).catch(handleError);
        return true;

      case 'openTabs':
        safeApiCall(async () => {
          await openTabsInCollection(request.collectionId);
          sendResponse({ success: true });
        }).catch(handleError);
        return true;

      case 'closeTabs':
        safeApiCall(async () => {
          await closeTabsInCollection(request.tabIds);
          sendResponse({ success: true });
        }).catch(handleError);
        return true;

      case 'syncTabs':
        safeApiCall(async () => {
          await syncTabs();
          sendResponse({ success: true });
        }).catch(handleError);
        return true;

      case 'updatePreferences':
        safeApiCall(async () => {
          await updateUserPreferences(request.preferences);
          sendResponse({ success: true });
        }).catch(handleError);
        return true;


    }
  } catch (error) {
    handleError(error);
  }
});

// Sync tabs with cloud when alarm triggers
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncTabs' && userPreferences.syncEnabled) {
    syncTabs();
  }
});

// Helper functions

function saveTabToHistory(tab) {
  // Auto-save tab to recent history
  const timestamp = Date.now();
  chrome.storage.local.get(['tabHistory'], (result) => {
    let tabHistory = result.tabHistory || [];

    // Add to history, limiting to 100 entries
    tabHistory.unshift({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      favicon: tab.favIconUrl,
      timestamp
    });

    if (tabHistory.length > 100) {
      tabHistory = tabHistory.slice(0, 100);
    }

    chrome.storage.local.set({ tabHistory });
  });
}

function handleTabRemoval(tabId) {
  // Check if tab is in any collection and update UI if needed
  for (const collectionId in collections) {
    const tabIndex = collections[collectionId].tabs.findIndex(tab => tab.id === tabId);
    if (tabIndex !== -1) {
      // Tab was in a collection, update UI
      chrome.runtime.sendMessage({
        action: 'tabRemoved',
        collectionId,
        tabId
      });
    }
  }
}

function saveCollection(collection) {
  collections[collection.id] = collection;
  chrome.storage.local.set({ collections });

  // If sync is enabled, push to cloud
  if (userPreferences.syncEnabled) {
    syncTabs();
  }
}

function openTabsInCollection(collectionId) {
  const collection = collections[collectionId];
  if (!collection) return;

  collection.tabs.forEach(tab => {
    chrome.tabs.create({
      url: tab.url,
      active: false
    });
  });
}

function closeTabsInCollection(tabIds) {
  chrome.tabs.remove(tabIds);
}

async function syncTabs() {
  try {
    await syncAll();
  } catch (e) {
    console.warn('Sync skipped or failed:', e?.message || e);
  }
}

function updateUserPreferences(preferences) {
  userPreferences = { ...userPreferences, ...preferences };
  chrome.storage.local.set({ userPreferences });
}

// Auth message handlers and realtime wiring
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  const respondErr = (e) => sendResponse({ error: e?.message || String(e) });
  (async () => {
    try {
      if (request.action === 'authRegister') {
        const { data, error } = await signUp({ email: request.email, password: request.password });
        if (error) throw new Error(error.message);
        await migrateLocalToCloud();
        if (realtimeDispose) { try { realtimeDispose(); } catch (_) {} }
        realtimeDispose = startRealtime();
        sendResponse({ success: true, data });
      } else if (request.action === 'authLogin') {
        const { data, error } = await signIn({ email: request.email, password: request.password });
        if (error) throw new Error(error.message);
        if (realtimeDispose) { try { realtimeDispose(); } catch (_) {} }
        realtimeDispose = startRealtime();
        await pullAll();
        sendResponse({ success: true, data });
      } else if (request.action === 'authLogout') {
        await signOut();
        if (realtimeDispose) { try { realtimeDispose(); } catch (_) {} }
        realtimeDispose = null;
        stopRealtime();
        sendResponse({ success: true });
      } else if (request.action === 'authGetSession') {
        const { data, error } = await getSession();
        if (error) throw new Error(error.message);
        sendResponse({ success: true, data });
      }
    } catch (e) {
      respondErr(e);
    }
  })();
  return true;
});

// Initialize realtime on startup if already signed in
chrome.runtime.onStartup.addListener(async () => {
  try {
    const { data } = await getSession();
    if (data?.session?.user) {
      if (realtimeDispose) { try { realtimeDispose(); } catch (_) {} }
      realtimeDispose = startRealtime();
      await pullAll();
    }
  } catch (_) {}
});