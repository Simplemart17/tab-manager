// Popup script for Tab Manager Pro

// DOM Elements
const openTabsList = document.getElementById('open-tabs');
const collectionsList = document.getElementById('collections-list');
const saveAllTabsBtn = document.getElementById('save-all-tabs-btn');
const newCollectionBtn = document.getElementById('new-collection-btn');
const syncBtn = document.getElementById('sync-btn');
const settingsBtn = document.getElementById('settings-btn');

// Modals
const saveCollectionModal = document.getElementById('save-collection-modal');
const settingsModal = document.getElementById('settings-modal');
const shareModal = document.getElementById('share-modal');

// Save Collection Modal
const collectionNameInput = document.getElementById('collection-name');
const selectedTabsList = document.getElementById('selected-tabs');
const cancelSaveBtn = document.getElementById('cancel-save');
const confirmSaveBtn = document.getElementById('confirm-save');

// Settings Modal
const themeSelect = document.getElementById('theme-select');
const syncEnabledCheck = document.getElementById('sync-enabled');
const autoSaveEnabledCheck = document.getElementById('auto-save-enabled');
const collaborationEnabledCheck = document.getElementById('collaboration-enabled');
const cancelSettingsBtn = document.getElementById('cancel-settings');
const saveSettingsBtn = document.getElementById('save-settings');

// Share Modal
const shareEmailInput = document.getElementById('share-email');
const addEmailBtn = document.getElementById('add-email');
const shareEmailsList = document.getElementById('share-emails-list');
const cancelShareBtn = document.getElementById('cancel-share');
const confirmShareBtn = document.getElementById('confirm-share');

// State
let currentTabs = [];
let collections = {};
let selectedTabs = [];
let emailsToShare = [];
let currentCollectionToShare = null;
let userPreferences = {
  theme: 'light',
  syncEnabled: true,
  autoSaveEnabled: true,
  collaborationEnabled: true
};

// Error handling and context validation
const handleChromeError = (error) => {
  console.error('Chrome API error:', error);
  if (error.message.includes('Extension context invalidated')) {
    // Show error message to user
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = 'Extension context has been invalidated. Please refresh the page.';
    document.body.insertBefore(errorDiv, document.body.firstChild);
    
    // Disable all interactive elements
    document.querySelectorAll('button').forEach(btn => btn.disabled = true);
    document.querySelectorAll('input').forEach(input => input.disabled = true);
  }
};

// Safe Chrome API wrapper
const safeApiCall = async (apiCall) => {
  try {
    return await apiCall();
  } catch (error) {
    handleChromeError(error);
    throw error;
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadUserPreferences();
  loadCollections();
  loadOpenTabs();
  setupEventListeners();
});

// Load user preferences
async function loadUserPreferences() {
  try {
    const result = await safeApiCall(() => chrome.storage.local.get(['userPreferences']));
    if (result.userPreferences) {
      userPreferences = result.userPreferences;
      
      // Apply theme
      if (userPreferences.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else if (userPreferences.theme === 'system') {
        const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
        if (prefersDarkScheme.matches) {
          document.documentElement.setAttribute('data-theme', 'dark');
        }
      }
      
      // Update form elements
      themeSelect.value = userPreferences.theme;
      syncEnabledCheck.checked = userPreferences.syncEnabled;
      autoSaveEnabledCheck.checked = userPreferences.autoSaveEnabled;
      collaborationEnabledCheck.checked = userPreferences.collaborationEnabled;
    }
  } catch (error) {
    handleChromeError(error);
  }
}

// Load collections from storage
async function loadCollections() {
  try {
    const result = await safeApiCall(() => chrome.storage.local.get(['collections']));
    if (result.collections) {
      collections = result.collections;
      renderCollections();
    }
  } catch (error) {
    handleChromeError(error);
  }
}

// Load open tabs
async function loadOpenTabs() {
  try {
    const tabs = await safeApiCall(() => chrome.tabs.query({}));
    currentTabs = tabs;
    renderOpenTabs();
  } catch (error) {
    handleChromeError(error);
  }
}

// Render open tabs list
function renderOpenTabs() {
  openTabsList.innerHTML = '';
  
  currentTabs.forEach(tab => {
    const tabElement = createTabElement(tab);
    openTabsList.appendChild(tabElement);
  });
}

// Create tab element
function createTabElement(tab) {
  const tabElement = document.createElement('div');
  tabElement.className = 'tab-item';
  tabElement.dataset.tabId = tab.id;
  
  const favicon = document.createElement('img');
  favicon.className = 'tab-favicon';
  favicon.src = tab.favIconUrl || chrome.runtime.getURL('assets/icons/icon16.png');
  favicon.onerror = () => {
    favicon.src = chrome.runtime.getURL('assets/icons/icon16.png');
  };
  
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title;
  
  const actions = document.createElement('div');
  actions.className = 'tab-actions';
  
  const saveBtn = document.createElement('button');
  saveBtn.className = 'tab-btn';
  saveBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
      <polyline points="17 21 17 13 7 13 7 21"></polyline>
      <polyline points="7 3 7 8 15 8"></polyline>
    </svg>
  `;
  saveBtn.title = 'Save tab';
  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showSaveModal([tab]);
  });
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-btn';
  closeBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  closeBtn.title = 'Close tab';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.tabs.remove(tab.id);
    tabElement.remove();
  });
  
  actions.appendChild(saveBtn);
  actions.appendChild(closeBtn);
  
  tabElement.appendChild(favicon);
  tabElement.appendChild(title);
  tabElement.appendChild(actions);
  
  tabElement.addEventListener('click', () => {
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  });
  
  return tabElement;
}

// Render collections
function renderCollections() {
  collectionsList.innerHTML = '';
  
  Object.values(collections).forEach(collection => {
    const collectionElement = createCollectionElement(collection);
    collectionsList.appendChild(collectionElement);
  });
}

// Create collection element
function createCollectionElement(collection) {
  const collectionElement = document.createElement('div');
  collectionElement.className = 'collection-item';
  collectionElement.dataset.collectionId = collection.id;
  
  const header = document.createElement('div');
  header.className = 'collection-header';
  
  const title = document.createElement('div');
  title.className = 'collection-title';
  title.textContent = collection.name;
  
  const tabCount = document.createElement('div');
  tabCount.className = 'collection-tab-count';
  tabCount.textContent = `${collection.tabs.length} tab${collection.tabs.length !== 1 ? 's' : ''}`;
  
  header.appendChild(title);
  header.appendChild(tabCount);
  
  const tabs = document.createElement('div');
  tabs.className = 'collection-tabs';
  
  // Show up to 5 tab favicons
  collection.tabs.slice(0, 5).forEach(tab => {
    const tabIcon = document.createElement('div');
    tabIcon.className = 'collection-tab';
    
    const favicon = document.createElement('img');
    favicon.src = tab.favicon || chrome.runtime.getURL('assets/icons/icon16.png');
    favicon.onerror = () => {
      favicon.src = chrome.runtime.getURL('assets/icons/icon16.png');
    };
    
    tabIcon.appendChild(favicon);
    tabs.appendChild(tabIcon);
  });
  
  const actions = document.createElement('div');
  actions.className = 'collection-actions';
  
  const openBtn = document.createElement('button');
  openBtn.className = 'collection-btn';
  openBtn.textContent = 'Open All';
  openBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openCollection(collection.id);
  });
  
  const shareBtn = document.createElement('button');
  shareBtn.className = 'collection-btn';
  shareBtn.textContent = 'Share';
  shareBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showShareModal(collection.id);
  });
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'collection-btn';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteCollection(collection.id);
  });
  
  actions.appendChild(openBtn);
  
  // Only show share button if collaboration is enabled
  if (userPreferences.collaborationEnabled) {
    actions.appendChild(shareBtn);
  }
  
  actions.appendChild(deleteBtn);
  
  collectionElement.appendChild(header);
  collectionElement.appendChild(tabs);
  collectionElement.appendChild(actions);
  
  return collectionElement;
}

// Set up event listeners
function setupEventListeners() {  
  // New collection button
  newCollectionBtn.addEventListener('click', () => {
    showSaveModal([]);
  });
  
  // Sync button
  syncBtn.addEventListener('click', () => {
    syncTabs();
  });
  
  // Settings button
  settingsBtn.addEventListener('click', () => {
    showSettingsModal();
  });
  
  // Cancel save button
  cancelSaveBtn.addEventListener('click', () => {
    hideSaveModal();
  });
  
  // Confirm save button
  confirmSaveBtn.addEventListener('click', () => {
    saveCollection();
  });
  
  // Cancel settings button
  cancelSettingsBtn.addEventListener('click', () => {
    hideSettingsModal();
  });
  
  // Save settings button
  saveSettingsBtn.addEventListener('click', () => {
    saveSettings();
  });
  
  // Add email button
  addEmailBtn.addEventListener('click', () => {
    addEmailToShare();
  });
  
  // Share email input enter key
  shareEmailInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      addEmailToShare();
    }
  });
  
  // Cancel share button
  cancelShareBtn.addEventListener('click', () => {
    hideShareModal();
  });
  
  // Confirm share button
  confirmShareBtn.addEventListener('click', () => {
    shareCollection();
  });
}

// Show save collection modal
function showSaveModal(tabs) {
  selectedTabs = tabs;
  
  // Clear previous data
  collectionNameInput.value = '';
  selectedTabsList.innerHTML = '';
  
  // Add selected tabs to the list
  selectedTabs.forEach(tab => {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab-item';
    
    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    favicon.src = tab.favIconUrl || chrome.runtime.getURL('assets/icons/icon16.png');
    favicon.onerror = () => {
      favicon.src = chrome.runtime.getURL('assets/icons/icon16.png');
    };
    
    const title = document.createElement('div');
    title.className = 'tab-title';
    title.textContent = tab.title;
    
    tabElement.appendChild(favicon);
    tabElement.appendChild(title);
    
    selectedTabsList.appendChild(tabElement);
  });
  
  saveCollectionModal.classList.add('show');
}

// Hide save collection modal
function hideSaveModal() {
  saveCollectionModal.classList.remove('show');
  selectedTabs = [];
}

// Show settings modal
function showSettingsModal() {
  settingsModal.classList.add('show');
}

// Hide settings modal
function hideSettingsModal() {
  settingsModal.classList.remove('show');
}

// Show share modal
function showShareModal(collectionId) {
  currentCollectionToShare = collectionId;
  emailsToShare = [];
  shareEmailInput.value = '';
  shareEmailsList.innerHTML = '';
  
  shareModal.classList.add('show');
}

// Hide share modal
function hideShareModal() {
  shareModal.classList.remove('show');
  currentCollectionToShare = null;
  emailsToShare = [];
}

// Add email to share list
function addEmailToShare() {
  const email = shareEmailInput.value.trim();
  
  if (email && isValidEmail(email) && !emailsToShare.includes(email)) {
    emailsToShare.push(email);
    
    const emailElement = document.createElement('div');
    emailElement.className = 'email-item';
    
    const emailText = document.createElement('div');
    emailText.className = 'email-text';
    emailText.textContent = email;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-email';
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', () => {
      emailsToShare = emailsToShare.filter(e => e !== email);
      emailElement.remove();
    });
    
    emailElement.appendChild(emailText);
    emailElement.appendChild(removeBtn);
    
    shareEmailsList.appendChild(emailElement);
    shareEmailInput.value = '';
  }
}

// Save collection
function saveCollection() {
  const name = collectionNameInput.value.trim();
  
  if (!name) {
    alert('Please enter a collection name');
    return;
  }
  
  const collectionId = `collection-${Date.now()}`;
  
  const tabs = selectedTabs.map(tab => ({
    id: tab.id,
    url: tab.url,
    title: tab.title,
    favicon: tab.favIconUrl || chrome.runtime.getURL('assets/icons/icon16.png')
  }));
  
  const collection = {
    id: collectionId,
    name,
    tabs,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  // Save to collections
  collections[collectionId] = collection;
  chrome.storage.local.set({ collections }, () => {
    renderCollections();
    hideSaveModal();
    
    // Send message to background script
    chrome.runtime.sendMessage({
      action: 'saveCollection',
      collection
    });
  });
}

// Open collection tabs
function openCollection(collectionId) {
  chrome.runtime.sendMessage({
    action: 'openTabs',
    collectionId
  });
}

// Delete collection
function deleteCollection(collectionId) {
  if (confirm('Are you sure you want to delete this collection?')) {
    delete collections[collectionId];
    chrome.storage.local.set({ collections }, () => {
      renderCollections();
    });
  }
}

// Save settings
function saveSettings() {
  userPreferences = {
    theme: themeSelect.value,
    syncEnabled: syncEnabledCheck.checked,
    autoSaveEnabled: autoSaveEnabledCheck.checked,
    collaborationEnabled: collaborationEnabledCheck.checked
  };
  
  chrome.storage.local.set({ userPreferences }, () => {
    // Apply theme
    if (userPreferences.theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (userPreferences.theme === 'light') {
      document.documentElement.removeAttribute('data-theme');
    } else if (userPreferences.theme === 'system') {
      const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
      if (prefersDarkScheme.matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }
    
    // Send message to background script
    chrome.runtime.sendMessage({
      action: 'updatePreferences',
      preferences: userPreferences
    });
    
    hideSettingsModal();
    
    // Refresh collections to update UI (if collaboration setting changed)
    renderCollections();
  });
}

// Share collection
function shareCollection() {
  if (emailsToShare.length === 0) {
    alert('Please add at least one email to share with');
    return;
  }
  
  if (!currentCollectionToShare) {
    alert('Invalid collection to share');
    return;
  }
  
  chrome.runtime.sendMessage({
    action: 'shareCollection',
    collectionId: currentCollectionToShare,
    users: emailsToShare
  });
  
  hideShareModal();
}

// Sync tabs
function syncTabs() {
  if (!userPreferences.syncEnabled) {
    alert('Sync is disabled. Enable it in settings first.');
    return;
  }
  
  // Show syncing animation
  syncBtn.classList.add('syncing');
  
  chrome.runtime.sendMessage({
    action: 'syncTabs'
  }, () => {
    // Remove syncing animation after a delay
    setTimeout(() => {
      syncBtn.classList.remove('syncing');
    }, 1000);
  });
}

// Helper function to validate email
function isValidEmail(email) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}