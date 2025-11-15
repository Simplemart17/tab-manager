/**
 * Background script for Simple Tab Plus
 *
 * AUTHENTICATION REQUIREMENT:
 * This app is strictly for authenticated users. All users must log in before using the app.
 * Unauthenticated users are automatically redirected to the auth page.
 * All data is synced to Supabase and requires a valid user session.
 */
import { bidirectionalSync, pullAll, startRealtime, stopRealtime } from './services/sync-service.js';
import { signUp, signIn, signOut, getSession, validateSession } from './services/auth-service.js';
import { migrateLocalToCloud } from './services/migration-service.js';
import dataService from './services/data.js';

// Configurable sync interval (default: 5 minutes = 300000 milliseconds)
let SYNC_INTERVAL = 300000; // 5 minutes in milliseconds
let realtimeDispose = null;

// Function to update sync interval
function setSyncInterval(intervalMinutes) {
  SYNC_INTERVAL = intervalMinutes * 60 * 1000;
  console.log(`Sync interval updated to ${intervalMinutes} minutes (${SYNC_INTERVAL}ms)`);

  // Clear existing alarm and create new one
  chrome.alarms.clear('syncTabs', () => {
    chrome.alarms.create('syncTabs', {
      periodInMinutes: intervalMinutes
    });
  });
}

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
let syncedTabs = {};
let userPreferences = {
  theme: 'dark',
  syncEnabled: false, // Disable sync by default - user must explicitly enable
  autoSaveEnabled: true
};

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  // Load stored user preferences if available
  chrome.storage.local.get(['userPreferences'], (result) => {
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

  // Setup alarm for periodic syncing (default: 5 minutes)
  chrome.alarms.create('syncTabs', {
    periodInMinutes: 5 // 5 minutes (configurable via setSyncInterval)
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
        safeApiCall(async () => {
          const collections = await dataService.getCollections();
          sendResponse({ collections });
        }).catch(handleError);
        return true;

      case 'saveCollection':
        safeApiCall(async () => {
          await dataService.createCollection(request.collection.name, request.collection.spaceId, request.collection.tabs || []);
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
          // isManualSync = true indicates this is from the sync button (not background sync)
          await syncTabs(true);
          sendResponse({ success: true });
        }).catch(handleError);
        return true;

      case 'immediateSyncTabs':
        safeApiCall(async () => {
          // Immediate sync triggered from data operations (not manual)
          await syncTabs(false);
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

// Sync tabs with cloud when alarm triggers (daily bidirectional sync)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncTabs' && userPreferences.syncEnabled) {
    // Perform bidirectional sync (push and pull)
    bidirectionalSync().catch(e => {
      console.warn('Scheduled bidirectional sync failed:', e?.message || e);
    });
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

async function handleTabRemoval(tabId) {
  try {
    const collections = await dataService.getCollections();
    for (const collection of collections) {
      const tabs = collection.tabs || [];
      const tabIndex = tabs.findIndex(tab => (tab.chromeTabId === tabId) || (tab.id === tabId));
      if (tabIndex !== -1) {
        // Tab was in a collection, update UI
        chrome.runtime.sendMessage({
          action: 'tabRemoved',
          collectionId: collection.id,
          tabId
        });
      }
    }
  } catch (error) {
    console.error('Failed to handle tab removal', error);
  }
}

async function openTabsInCollection(collectionId) {
  try {
    const collection = await dataService.getCollection(collectionId);
    if (!collection || !collection.tabs || collection.tabs.length === 0) return;

    collection.tabs.forEach(tab => {
      chrome.tabs.create({
        url: tab.url,
        active: false
      });
    });
  } catch (error) {
    console.error('Failed to open tabs in collection', error);
  }
}

function closeTabsInCollection(tabIds) {
  chrome.tabs.remove(tabIds);
}

async function syncTabs(isManualSync = false) {
  try {
    // Perform bidirectional sync: push local changes and pull remote changes
    const result = await bidirectionalSync();

    if (result.ok) {
      console.log('Sync completed successfully');

      // If manual sync (from sync button), notify user and refresh UI
      if (isManualSync) {
        // Send message to all tabs to refresh data from server and show notification
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'refreshDataFromServer',
              showNotification: true,
              message: 'Sync successfully completed'
            }).catch(() => {
              // Ignore errors for tabs that don't have content script
            });
          });
        });
      }
    } else {
      console.warn('Sync failed:', result.reason);
      if (isManualSync) {
        // Notify user of sync failure
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
              action: 'refreshDataFromServer',
              showNotification: true,
              message: `Sync failed: ${result.reason || 'Unknown error'}`,
              notificationType: 'error'
            }).catch(() => {
              // Ignore errors for tabs that don't have content script
            });
          });
        });
      }
    }
  } catch (e) {
    console.warn('Sync skipped or failed:', e?.message || e);
    if (isManualSync) {
      // Notify user of sync error
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            action: 'refreshDataFromServer',
            showNotification: true,
            message: `Sync error: ${e?.message || 'An error occurred during sync'}`,
            notificationType: 'error'
          }).catch(() => {
            // Ignore errors for tabs that don't have content script
          });
        });
      });
    }
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
        // Only migrate and start realtime if sync is enabled
        if (userPreferences.syncEnabled) {
          await migrateLocalToCloud();
          if (realtimeDispose) { try { realtimeDispose(); } catch (_) {} }
          realtimeDispose = startRealtime();
        }
        sendResponse({ success: true, data });
      } else if (request.action === 'authLogin') {
        const { data, error } = await signIn({ email: request.email, password: request.password });
        if (error) throw new Error(error.message);
        if (realtimeDispose) { try { realtimeDispose(); } catch (_) {} }

        // ALWAYS pull user's data from cloud on login (regardless of sync setting)
        // This ensures existing users get their data on new devices
        await pullAll();

        // Start realtime sync only if sync is enabled
        if (userPreferences.syncEnabled) {
          realtimeDispose = startRealtime();
        }
        sendResponse({ success: true, data });
      } else if (request.action === 'authLogout') {
        await signOut();
        if (realtimeDispose) { try { realtimeDispose(); } catch (_) {} }
        realtimeDispose = null;
        stopRealtime();
        sendResponse({ success: true });
      } else if (request.action === 'authGetSession') {
        const sessionResult = await validateSession();
        if (sessionResult.valid) {
          sendResponse({ success: true, data: { session: sessionResult.session } });
        } else {
          // Don't throw error for invalid session, just return null
          sendResponse({ success: true, data: { session: null } });
        }
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

      // ALWAYS pull user's data on startup to ensure sync across devices
      await pullAll();

      // Start realtime sync only if sync is enabled
      if (userPreferences.syncEnabled) {
        realtimeDispose = startRealtime();
      }
    }
  } catch (_) {}
});