// New Tab script for Tab Manager Pro

// DOM Elements
const collectionsGrid = document.getElementById('collections-grid');
const tabsContainer = document.getElementById('tabs-container');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const syncBtn = document.getElementById('sync-btn');
const settingsBtn = document.getElementById('settings-btn');
const saveAllTabsBtn = document.getElementById('save-all-tabs-btn');
const closeAllTabsBtn = document.getElementById('close-all-tabs-btn');
const newCollectionBtn = document.getElementById('new-collection-btn');
const newWorkspaceBtn = document.getElementById('new-workspace-btn');
const inviteTeamBtn = document.getElementById('invite-team-btn');
const userBtn = document.getElementById('user-btn');
const userProfileLink = document.getElementById('user-profile-link');
const logoutLink = document.getElementById('logout-link');
const workspacesList = document.getElementById('workspaces-list');
const teamMembersList = document.getElementById('team-members-list');

// Modals
const saveCollectionModal = document.getElementById('save-collection-modal');
const settingsModal = document.getElementById('settings-modal');
const shareModal = document.getElementById('share-modal');
const workspaceModal = document.getElementById('workspace-modal');

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
const showRecentCheck = document.getElementById('show-recent');
const showWeatherCheck = document.getElementById('show-weather');
const showNotesCheck = document.getElementById('show-notes');
const cancelSettingsBtn = document.getElementById('cancel-settings');
const saveSettingsBtn = document.getElementById('save-settings');

// Share Modal
const shareEmailInput = document.getElementById('share-email');
const addEmailBtn = document.getElementById('add-email');
const shareEmailsList = document.getElementById('share-emails-list');
const cancelShareBtn = document.getElementById('cancel-share');
const confirmShareBtn = document.getElementById('confirm-share');

// Workspace Modal
const workspaceNameInput = document.getElementById('workspace-name');
const workspaceColorInput = document.getElementById('workspace-color');
const cancelWorkspaceBtn = document.getElementById('cancel-workspace');
const confirmWorkspaceBtn = document.getElementById('confirm-workspace');

// State
let currentTabs = [];
let collections = {};
let selectedTabs = [];
let emailsToShare = [];
let currentCollectionToShare = null;
let workspaces = [
  { id: 'personal', name: 'Personal', color: '#4f5bd5' },
  { id: 'work', name: 'Work', color: '#4caf50' },
  { id: 'research', name: 'Research', color: '#ff9800' }
];
let activeWorkspace = 'personal';
let teamMembers = [
  { id: 'user1', name: 'John Doe', avatar: 'J', isCurrentUser: true },
  { id: 'user2', name: 'Sarah Johnson', avatar: 'S', isCurrentUser: false },
  { id: 'user3', name: 'Mike Smith', avatar: 'M', isCurrentUser: false }
];
let userPreferences = {
  theme: 'light',
  syncEnabled: true,
  autoSaveEnabled: true,
  collaborationEnabled: true,
  showRecent: true,
  showWeather: true,
  showNotes: true
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadUserPreferences();
  loadCollections();
  loadOpenTabs();
  setupEventListeners();
});

// Load user preferences
function loadUserPreferences() {
  chrome.storage.local.get(['userPreferences'], (result) => {
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
      showRecentCheck.checked = userPreferences.showRecent;
      showWeatherCheck.checked = userPreferences.showWeather;
      showNotesCheck.checked = userPreferences.showNotes;
    }
  });
}

// Load collections from storage
function loadCollections() {
  chrome.storage.local.get(['collections'], (result) => {
    if (result.collections) {
      collections = result.collections;
      renderCollections();
    }
  });
}

// Load open tabs
function loadOpenTabs() {
  chrome.tabs.query({}, (tabs) => {
    currentTabs = tabs;
    renderOpenTabs();
  });
}

// Render collections grid
function renderCollections() {
  collectionsGrid.innerHTML = '';
  
  Object.values(collections).forEach(collection => {
    const collectionCard = createCollectionCard(collection);
    collectionsGrid.appendChild(collectionCard);
  });
}

// Create collection card element
function createCollectionCard(collection) {
  const card = document.createElement('div');
  card.className = 'collection-card';
  card.dataset.collectionId = collection.id;
  
  const header = document.createElement('div');
  header.className = 'collection-card-header';
  
  const title = document.createElement('div');
  title.className = 'collection-title';
  title.textContent = collection.name;
  
  const date = document.createElement('div');
  date.className = 'collection-date';
  date.textContent = formatDate(collection.createdAt);
  
  header.appendChild(title);
  header.appendChild(date);
  
  const preview = document.createElement('div');
  preview.className = 'collection-tabs-preview';
  
  // Show up to 10 tab favicons
  collection.tabs.slice(0, 10).forEach(tab => {
    const tabPreview = document.createElement('div');
    tabPreview.className = 'tab-preview';
    
    const favicon = document.createElement('img');
    favicon.src = tab.favicon || 'chrome://favicon';
    favicon.onerror = () => {
      favicon.src = 'chrome://favicon';
    };
    
    tabPreview.appendChild(favicon);
    preview.appendChild(tabPreview);
  });
  
  const info = document.createElement('div');
  info.className = 'collection-info';
  
  const tabCount = document.createElement('div');
  tabCount.textContent = `${collection.tabs.length} tab${collection.tabs.length !== 1 ? 's' : ''}`;
  
  const owner = document.createElement('div');
  owner.className = 'collection-owner';
  
  const shared = collection.shared ? `· Shared with ${collection.sharedWith?.length || 0} people` : '';
  owner.textContent = `You ${shared}`;
  
  info.appendChild(tabCount);
  info.appendChild(owner);
  
  card.appendChild(header);
  card.appendChild(preview);
  card.appendChild(info);
  
  // Event listener to open collection when card is clicked
  card.addEventListener('click', () => {
    openCollection(collection.id);
  });
  
  return card;
}

// Render open tabs
function renderOpenTabs() {
  tabsContainer.innerHTML = '';
  
  currentTabs.forEach(tab => {
    const tabCard = createTabCard(tab);
    tabsContainer.appendChild(tabCard);
  });
}

// Create tab card element
function createTabCard(tab) {
  const card = document.createElement('div');
  card.className = 'tab-card';
  card.dataset.tabId = tab.id;
  
  const favicon = document.createElement('img');
  favicon.className = 'tab-card-favicon';
  favicon.src = tab.favIconUrl || 'chrome://favicon';
  favicon.onerror = () => {
    favicon.src = 'chrome://favicon';
  };
  
  const title = document.createElement('div');
  title.className = 'tab-card-title';
  title.textContent = tab.title;
  
  const actions = document.createElement('div');
  actions.className = 'tab-card-actions';
  
  const saveBtn = document.createElement('button');
  saveBtn.className = 'tab-card-btn';
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
  closeBtn.className = 'tab-card-btn close';
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
    card.remove();
  });
  
  actions.appendChild(saveBtn);
  actions.appendChild(closeBtn);
  
  card.appendChild(favicon);
  card.appendChild(title);
  card.appendChild(actions);
  
  card.addEventListener('click', () => {
    chrome.tabs.update(tab.id, { active: true });
    chrome.windows.update(tab.windowId, { focused: true });
  });
  
  return card;
}

// Set up event listeners
function setupEventListeners() {
  // Search
  searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      performSearch(searchInput.value);
    }
  });
  
  searchBtn.addEventListener('click', () => {
    performSearch(searchInput.value);
  });
  
  // Sync button
  syncBtn.addEventListener('click', () => {
    syncTabs();
  });
  
  // Settings button
  settingsBtn.addEventListener('click', () => {
    showSettingsModal();
  });
  
  // New collection button
  newCollectionBtn.addEventListener('click', () => {
    showSaveModal([]);
  });
  
  // New workspace button
  newWorkspaceBtn.addEventListener('click', () => {
    showWorkspaceModal();
  });
  
  // Invite team button
  inviteTeamBtn.addEventListener('click', () => {
    showShareModal(null, true);
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
  
  // Cancel workspace button
  cancelWorkspaceBtn.addEventListener('click', () => {
    hideWorkspaceModal();
  });
  
  // Confirm workspace button
  confirmWorkspaceBtn.addEventListener('click', () => {
    createWorkspace();
  });
}

// Perform search
function performSearch(query) {
  if (!query) return;
  
  if (query.startsWith('http') || query.includes('.')) {
    // If the query looks like a URL, navigate to it
    chrome.tabs.create({ url: query.startsWith('http') ? query : `https://${query}` });
  } else {
    // Otherwise, search Google
    chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
  }
  
  searchInput.value = '';
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
    favicon.src = tab.favIconUrl || 'chrome://favicon';
    favicon.onerror = () => {
      favicon.src = 'chrome://favicon';
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
function showShareModal(collectionId, isTeamInvite = false) {
  currentCollectionToShare = collectionId;
  emailsToShare = [];
  shareEmailInput.value = '';
  shareEmailsList.innerHTML = '';
  
  // Change title for team invite
  const modalTitle = shareModal.querySelector('h3');
  modalTitle.textContent = isTeamInvite ? 'Invite Team Members' : 'Share Collection';
  
  shareModal.classList.add('show');
}

// Hide share modal
function hideShareModal() {
  shareModal.classList.remove('show');
  currentCollectionToShare = null;
  emailsToShare = [];
}

// Show workspace modal
function showWorkspaceModal() {
  workspaceModal.classList.add('show');
  workspaceNameInput.value = '';
  workspaceColorInput.value = '#4f5bd5';
}

// Hide workspace modal
function hideWorkspaceModal() {
  workspaceModal.classList.remove('show');
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
    favicon: tab.favIconUrl || 'chrome://favicon'
  }));
  
  const collection = {
    id: collectionId,
    name,
    tabs,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    workspace: activeWorkspace
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

// Save settings
function saveSettings() {
  userPreferences = {
    theme: themeSelect.value,
    syncEnabled: syncEnabledCheck.checked,
    autoSaveEnabled: autoSaveEnabledCheck.checked,
    collaborationEnabled: collaborationEnabledCheck.checked,
    showRecent: showRecentCheck.checked,
    showWeather: showWeatherCheck.checked,
    showNotes: showNotesCheck.checked
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

// Create workspace
function createWorkspace() {
  const name = workspaceNameInput.value.trim();
  const color = workspaceColorInput.value;
  
  if (!name) {
    alert('Please enter a workspace name');
    return;
  }
  
  const workspaceId = `workspace-${Date.now()}`;
  
  const workspace = {
    id: workspaceId,
    name,
    color
  };
  
  workspaces.push(workspace);
  
  // Update UI
  const workspaceItem = document.createElement('div');
  workspaceItem.className = 'sidebar-item';
  workspaceItem.innerHTML = `<span>${name}</span>`;
  workspaceItem.addEventListener('click', () => setActiveWorkspace(workspaceId));
  
  workspacesList.appendChild(workspaceItem);
  
  hideWorkspaceModal();
}

// Share collection
function shareCollection() {
  if (emailsToShare.length === 0) {
    alert('Please add at least one email to share with');
    return;
  }
  
  if (currentCollectionToShare) {
    // Sharing a collection
    chrome.runtime.sendMessage({
      action: 'shareCollection',
      collectionId: currentCollectionToShare,
      users: emailsToShare
    });
  } else {
    // Inviting team members
    console.log('Inviting team members:', emailsToShare);
    
    // In a real implementation, this would send invitations to join the team
    // For the demo, we'll just add mock users
    emailsToShare.forEach(email => {
      const name = email.split('@')[0];
      const avatar = name.charAt(0).toUpperCase();
      
      const teamMember = {
        id: `user-${Date.now()}`,
        name,
        avatar,
        isCurrentUser: false
      };
      
      teamMembers.push(teamMember);
      
      // Update UI
      const memberItem = document.createElement('div');
      memberItem.className = 'sidebar-item';
      memberItem.innerHTML = `
        <div class="avatar small">${avatar}</div>
        <span>${name}</span>
      `;
      
      teamMembersList.appendChild(memberItem);
    });
  }
  
  hideShareModal();
}

// Set active workspace
function setActiveWorkspace(workspaceId) {
  activeWorkspace = workspaceId;
  
  // Update UI
  const items = workspacesList.querySelectorAll('.sidebar-item');
  items.forEach(item => {
    item.classList.remove('active');
  });
  
  const activeItem = Array.from(items).find(item => 
    item.textContent.trim() === workspaces.find(w => w.id === workspaceId)?.name
  );
  if (activeItem) {
    activeItem.classList.add('active');
  }
  
  // Filter collections by workspace
  renderCollections();
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

// Helper function to format date
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

// Helper function to validate email
function isValidEmail(email) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
} 