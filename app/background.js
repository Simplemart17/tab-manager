// Background script for Tab Manager
const SYNC_INTERVAL = 30000; // 30 seconds

// Tab management state
let collections = {};
let syncedTabs = {};
let userPreferences = {
  theme: 'light',
  syncEnabled: true,
  autoSaveEnabled: true,
  collaborationEnabled: true
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

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && userPreferences.autoSaveEnabled) {
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
  switch (request.action) {
    case 'getCollections':
      sendResponse({ collections });
      break;
      
    case 'saveCollection':
      saveCollection(request.collection);
      sendResponse({ success: true });
      break;
      
    case 'getTabs':
      chrome.tabs.query({}, tabs => {
        sendResponse({ tabs });
      });
      return true; // Keep channel open for async response
      
    case 'openTabs':
      openTabsInCollection(request.collectionId);
      sendResponse({ success: true });
      break;
      
    case 'closeTabs':
      closeTabsInCollection(request.tabIds);
      sendResponse({ success: true });
      break;
      
    case 'syncTabs':
      syncTabs();
      sendResponse({ success: true });
      break;
      
    case 'updatePreferences':
      updateUserPreferences(request.preferences);
      sendResponse({ success: true });
      break;
      
    case 'shareCollection':
      shareCollection(request.collectionId, request.users);
      sendResponse({ success: true });
      break;
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

function syncTabs() {
  // This would connect to a cloud service
  // For this implementation, we'll mock the sync
  console.log('Syncing tabs to cloud...');
  
  // In a real implementation, this would send data to a server
  // and handle received updates from other devices/team members
}

function updateUserPreferences(preferences) {
  userPreferences = { ...userPreferences, ...preferences };
  chrome.storage.local.set({ userPreferences });
}

function shareCollection(collectionId, users) {
  // In a real implementation, this would send sharing invitations
  console.log(`Sharing collection ${collectionId} with users:`, users);
  
  // Mock implementation - mark collection as shared
  if (collections[collectionId]) {
    collections[collectionId].shared = true;
    collections[collectionId].sharedWith = users;
    chrome.storage.local.set({ collections });
  }
} 