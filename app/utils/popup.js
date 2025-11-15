// Popup script for Simple Tab Manager
import dataService from '../services/data.js';

function generateUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const hex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return (
    hex() + hex() + '-' +
    hex() + '-' +
    hex() + '-' +
    hex() + '-' +
    hex() + hex() + hex()
  );
}



// DOM Elements
const openTabsList = document.getElementById('open-tabs');
const collectionsList = document.getElementById('collections-list');
const workspacesList = document.getElementById('workspaces-list');
const saveAllTabsBtn = document.getElementById('save-all-tabs-btn');
const newCollectionBtn = document.getElementById('new-collection-btn');
const newWorkspaceBtn = document.getElementById('new-workspace-btn');
const syncBtn = document.getElementById('sync-btn');
const settingsBtn = document.getElementById('settings-btn');
const authLoginBtn = document.getElementById('auth-login-btn');
const authRegisterBtn = document.getElementById('auth-register-btn');
const collectionSpaceSelect = document.getElementById('collection-space');

// Modals
const saveCollectionModal = document.getElementById('save-collection-modal');
const settingsModal = document.getElementById('settings-modal');

// Save Collection Modal
const collectionNameInput = document.getElementById('collection-name');
const selectedTabsList = document.getElementById('selected-tabs');
const cancelSaveBtn = document.getElementById('cancel-save');
const confirmSaveBtn = document.getElementById('confirm-save');

// Settings Modal
const themeSelect = document.getElementById('theme-select');
const cancelSettingsBtn = document.getElementById('cancel-settings');
const saveSettingsBtn = document.getElementById('save-settings');



// State
let currentTabs = [];
let collections = {};
let selectedTabs = [];
let activeWorkspace = '';
let workspaces = [];
let userPreferences = {
  theme: 'dark',
  syncEnabled: true,
  autoSaveEnabled: true
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
document.addEventListener('DOMContentLoaded', async () => {
  // Check auth: if not signed in, open auth page in a new tab and close popup
  chrome.runtime.sendMessage({ action: 'authGetSession' }, async (resp) => {
    const signedIn = !!resp?.data?.session?.user;
    if (!signedIn) {
      chrome.tabs.create({ url: chrome.runtime.getURL('app/pages/newtab.html') });
      window.close();
      return;
    }
    // Hide Sign Up when user is authenticated
    if (authRegisterBtn) authRegisterBtn.style.display = 'none';

    // Continue normal initialization
    await loadUserPreferences();
    await loadCollections();
    await loadOpenTabs();
    setupEventListeners();
    await loadWorkspaces();
  });
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
// Load workspaces (dynamic)
async function loadWorkspaces() {
  try {
    workspaces = await dataService.getSpaces();

    if (!activeWorkspace || !workspaces.find(w => w.id === activeWorkspace)) {
      activeWorkspace = workspaces[0]?.id || '';
    }
    renderWorkspaces();
    populateWorkspaceSelect();
    filterCollectionsByWorkspace(activeWorkspace);
  } catch (e) {
    console.error('Failed to load workspaces', e);
  }
}

function renderWorkspaces() {
  workspacesList.innerHTML = '';
  workspaces.forEach((w, idx) => {
    const item = document.createElement('div');
    item.className = 'space-item' + ((w.id === activeWorkspace) ? ' active' : '');
    item.dataset.spaceId = w.id;

    const color = document.createElement('div');
    color.className = 'space-color';
    color.style.backgroundColor = w.color || '#914CE6';

    const name = document.createElement('div');
    name.className = 'space-name';
    name.textContent = w.name;

    item.appendChild(color);
    item.appendChild(name);

    item.addEventListener('click', () => {
      activeWorkspace = w.id;
      renderWorkspaces();
      filterCollectionsByWorkspace(activeWorkspace);
    });

    workspacesList.appendChild(item);
  });
}

function populateWorkspaceSelect() {
  if (!collectionSpaceSelect) return;
  collectionSpaceSelect.innerHTML = '';
  workspaces.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w.id;
    opt.textContent = w.name;
    collectionSpaceSelect.appendChild(opt);
  });
  collectionSpaceSelect.value = activeWorkspace;
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
  const defaultIcon = chrome.runtime.getURL('app/assets/icons/icon16.png');
  favicon.src = tab.favIconUrl || defaultIcon;
  favicon.onerror = () => {
    favicon.onerror = null; // prevent infinite loop
    favicon.src = defaultIcon;
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

  // Find the workspace color
  const workspace = workspaces.find(w => w.id === collection.workspace) || workspaces[0];
  collectionElement.style.borderLeft = `4px solid ${workspace.color}`;

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
    const defaultIcon = chrome.runtime.getURL('app/assets/icons/icon16.png');
    favicon.src = tab.favicon || defaultIcon;
    favicon.onerror = () => {
      favicon.onerror = null;
      favicon.src = defaultIcon;
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



  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'collection-btn';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteCollection(collection.id);
  });

  actions.appendChild(openBtn);


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

  // New workspace button
  newWorkspaceBtn.addEventListener('click', () => {
    showWorkspaceModal();
  });

  // Sync button (removed from popup UI). Guard in case it's present.
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      syncTabs();
    });
  }

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

  // Auth buttons
  // Auth buttons: bind based on current session state
  const bindAuthButtons = () => {
    chrome.runtime.sendMessage({ action: 'authGetSession' }, (resp) => {
      const signedIn = !!resp?.data?.session?.user;
      if (signedIn) {
        if (authRegisterBtn) authRegisterBtn.style.display = 'none';
        if (authLoginBtn) {
          authLoginBtn.textContent = 'Sign Out';
          authLoginBtn.title = 'Sign out';
          authLoginBtn.onclick = () => {
            chrome.runtime.sendMessage({ action: 'authLogout' }, () => {
              chrome.tabs.create({ url: chrome.runtime.getURL('app/pages/newtab.html') });
              window.close();
            });
          };
        }
      } else {
        if (authLoginBtn) {
          authLoginBtn.textContent = 'Sign In';
          authLoginBtn.title = 'Sign in';
          authLoginBtn.onclick = () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('app/pages/auth.html#signin') });
            window.close();
          };
        }
        if (authRegisterBtn) {
          authRegisterBtn.style.display = '';
          authRegisterBtn.onclick = () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('app/pages/auth.html#signup') });
            window.close();
          };
        }
      }
    });
  };
  bindAuthButtons();


  // Setup workspace items click events
  const spaceItems = workspacesList.querySelectorAll('.space-item');
  spaceItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active class from all items
      spaceItems.forEach(i => i.classList.remove('active'));
      // Add active class to clicked item
      item.classList.add('active');
      // Set active workspace
      activeWorkspace = item.dataset.spaceId;
      // Filter collections by workspace
      filterCollectionsByWorkspace(activeWorkspace);
    });
  });
}

// Show save collection modal
function showSaveModal(tabs) {
  selectedTabs = tabs;

  // Clear previous data
  collectionNameInput.value = '';
  selectedTabsList.innerHTML = '';
  collectionSpaceSelect.value = activeWorkspace;

  // Add selected tabs to the list
  selectedTabs.forEach(tab => {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab-item';

    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    const defaultIcon = chrome.runtime.getURL('app/assets/icons/icon16.png');
    favicon.src = tab.favIconUrl || defaultIcon;
    favicon.onerror = () => {
      favicon.onerror = null;
      favicon.src = defaultIcon;
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





// Save collection
function saveCollection() {
  const name = collectionNameInput.value.trim();
  const space = collectionSpaceSelect.value;

  if (!name) {
    alert('Please enter a collection name');
    return;
  }

  const collectionId = generateUuid();

  const defaultIcon = chrome.runtime.getURL('app/assets/icons/icon16.png');
  const tabs = selectedTabs.map(tab => ({
    id: generateUuid(),
    chromeTabId: tab.id,
    url: tab.url,
    title: tab.title,
    favicon: tab.favIconUrl || defaultIcon
  }));

  const collection = {
    id: collectionId,
    name,
    tabs,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    workspace: space
  };

  // Save to collections
  collections[collectionId] = collection;
  chrome.storage.local.set({ collections }, () => {
    filterCollectionsByWorkspace(activeWorkspace);
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
    theme: themeSelect.value
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



// Sync tabs
function syncTabs() {
  if (!userPreferences.syncEnabled) {
    alert('Sync is disabled. Enable it in settings first.');
    return;
  }
  if (!syncBtn) {
    chrome.runtime.sendMessage({ action: 'syncTabs' });
    return;
  }

  // Prevent multiple sync operations
  if (syncBtn.classList.contains('syncing')) return;

  // Add syncing state - this will trigger the CSS animation and disable the button
  syncBtn.classList.add('syncing');
  syncBtn.disabled = true;

  chrome.runtime.sendMessage({ action: 'syncTabs' }, (response) => {
    // Remove syncing state after a minimum duration to ensure user sees the animation
    setTimeout(() => {
      if (syncBtn) {
        syncBtn.classList.remove('syncing');
        syncBtn.disabled = false;
      }
    }, 1000);
  });
}


// Filter collections by workspace
function filterCollectionsByWorkspace(workspaceId) {
  collectionsList.innerHTML = '';

  Object.values(collections)
    .filter(collection => !workspaceId || collection.workspace === workspaceId)
    .forEach(collection => {
      const collectionElement = createCollectionElement(collection);
      collectionsList.appendChild(collectionElement);
    });
}

// Show workspace modal
function showWorkspaceModal() {
  // Implement workspace modal
  alert('Create new workspace feature coming soon!');
}