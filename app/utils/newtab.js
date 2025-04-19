// New Tab script for Toby Tab Manager
import dataService from '../services/data.js';
import dragDropService from '../services/dragdrop.js';

// DOM Elements
const collectionsList = document.getElementById('collections-list');
const tabsContainer = document.getElementById('tabs-container');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const syncBtn = document.getElementById('sync-btn');
const settingsBtn = document.getElementById('settings-btn');
const saveAllTabsBtn = document.getElementById('save-all-tabs-btn');
const newCollectionBtn = document.getElementById('new-collection-btn');
const newWorkspaceBtn = document.getElementById('new-workspace-btn');
const workspacesList = document.getElementById('workspaces-list');
const collectionSpaceSelect = document.getElementById('collection-space');
const exportDataBtn = document.getElementById('export-data-btn');
const importDataBtn = document.getElementById('import-data-btn');
const importDataFile = document.getElementById('import-data-file');

// Tabs Pane Elements
const tabsPane = document.getElementById('tabs-pane');
const tabsToggleBtn = document.getElementById('tabs-toggle-btn');
const closeTabsPaneBtn = document.getElementById('close-tabs-pane');
const tabsCount = document.querySelector('.tabs-count');
const tabsToggleIcon = document.querySelector('.tabs-toggle-icon');

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
const shareEmailsList = document.getElementById('share-emails');
const cancelShareBtn = document.getElementById('cancel-share');
const confirmShareBtn = document.getElementById('confirm-share');

// Workspace Modal
const workspaceNameInput = document.getElementById('workspace-name');
const workspaceColorInput = document.getElementById('workspace-color');
const cancelWorkspaceBtn = document.getElementById('cancel-workspace');
const confirmWorkspaceBtn = document.getElementById('confirm-workspace');

// State
let currentTabs = [];
let selectedTabs = [];
let emailsToShare = [];
let activeWorkspace = 'personal';
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
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize data service
    await dataService.init();

    // Load user preferences
    await loadUserPreferences();

    // Load spaces
    await loadSpaces();

    // Load collections
    await loadCollections();

    // Load open tabs
    loadOpenTabs();

    // Setup event listeners
    setupEventListeners();

    // Listen for data changes from drag and drop operations
    document.addEventListener('toby-data-change', async () => {
      await loadCollections();
    });

    // Listen for tab updates
    chrome.tabs.onCreated.addListener(() => {
      loadOpenTabs();
    });

    chrome.tabs.onRemoved.addListener(() => {
      loadOpenTabs();
    });

    chrome.tabs.onUpdated.addListener(() => {
      loadOpenTabs();
    });
  } catch (error) {
    console.error('Error initializing app:', error);
  }
});

// Load user preferences
async function loadUserPreferences() {
  try {
    const settings = await dataService.getSettings();
    userPreferences = settings;

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
  } catch (error) {
    console.error('Error loading user preferences:', error);
  }
}

// Load spaces
async function loadSpaces() {
  try {
    const spaces = await dataService.getSpaces();

    // Update workspaces list
    renderWorkspaces(spaces);

    // Update collection space select
    updateCollectionSpaceSelect(spaces);
  } catch (error) {
    console.error('Error loading spaces:', error);
  }
}

// Render workspaces
function renderWorkspaces(spaces) {
  workspacesList.innerHTML = '';

  spaces.forEach(space => {
    const workspaceItem = document.createElement('div');
    workspaceItem.className = 'sidebar-item';
    workspaceItem.dataset.spaceId = space.id;
    if (space.id === activeWorkspace) {
      workspaceItem.classList.add('active');
    }

    workspaceItem.innerHTML = `<span>${space.name}</span>`;

    workspaceItem.addEventListener('click', () => {
      setActiveWorkspace(space.id);
    });

    // Set up as drop target for collections
    dragDropService.setupSpaceDropTarget(workspaceItem, space.id);

    workspacesList.appendChild(workspaceItem);
  });
}

// Update collection space select
function updateCollectionSpaceSelect(spaces) {
  collectionSpaceSelect.innerHTML = '';

  spaces.forEach(space => {
    const option = document.createElement('option');
    option.value = space.id;
    option.textContent = space.name;
    collectionSpaceSelect.appendChild(option);
  });

  collectionSpaceSelect.value = activeWorkspace;
}

// Load collections
async function loadCollections() {
  try {
    // Filter collections by active workspace
    const collections = await dataService.getCollectionsBySpace(activeWorkspace);
    renderCollections(collections);
  } catch (error) {
    console.error('Error loading collections:', error);
  }
}

// Load open tabs
function loadOpenTabs() {
  chrome.tabs.query({}, (tabs) => {
    // Filter out the current tab (new tab page)
    currentTabs = tabs.filter(tab => !tab.url.includes('chrome://newtab'));
    renderOpenTabs();

    // If there are tabs, show the tabs pane toggle button
    if (currentTabs.length > 0) {
      tabsToggleBtn.style.display = 'flex';
    } else {
      tabsToggleBtn.style.display = 'none';
    }
  });
}

// Render collections
function renderCollections(collections) {
  collectionsList.innerHTML = '';

  collections.forEach(collection => {
    const collectionGroup = createCollectionGroup(collection);
    collectionsList.appendChild(collectionGroup);
  });
}

// Create collection group element
function createCollectionGroup(collection) {
  const group = document.createElement('div');
  group.className = 'collection-group';
  group.dataset.collectionId = collection.id;

  // Find the workspace color
  const spaceId = collection.spaceId || collection.workspace;
  let spaceColor = '#ff5c8d'; // Default color

  // Create header
  const header = document.createElement('div');
  header.className = 'collection-header';

  // Left side of header
  const headerLeft = document.createElement('div');
  headerLeft.className = 'collection-header-left';

  const title = document.createElement('div');
  title.className = 'collection-title';
  title.textContent = collection.name;

  headerLeft.appendChild(title);

  // Right side of header
  const headerRight = document.createElement('div');
  headerRight.className = 'collection-header-right';

  const count = document.createElement('div');
  count.className = 'collection-count';
  count.textContent = `${collection.tabs ? collection.tabs.length : 0} tab${collection.tabs && collection.tabs.length !== 1 ? 's' : ''}`;

  const toggleIcon = document.createElement('div');
  toggleIcon.className = 'collection-toggle-icon';
  toggleIcon.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;

  headerRight.appendChild(count);
  headerRight.appendChild(toggleIcon);

  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  // Create content container
  const content = document.createElement('div');
  content.className = 'collection-content';

  // Add tabs to content
  if (collection.tabs && collection.tabs.length > 0) {
    collection.tabs.forEach(tab => {
      const tabCard = createCollectionTabCard(tab, collection.id);
      content.appendChild(tabCard);
    });
  } else {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'No tabs in this collection';
    content.appendChild(emptyMessage);
  }

  group.appendChild(header);
  group.appendChild(content);

  // Set the border color based on workspace
  if (spaceId) {
    dataService.getSpace(spaceId).then(space => {
      if (space) {
        spaceColor = space.color;
        header.style.borderLeftColor = spaceColor;
      }
    });
  }

  // Toggle collection collapse when header is clicked
  header.addEventListener('click', () => {
    toggleCollectionCollapse(group);
  });

  // Set up drag and drop
  dragDropService.setupCollectionDragDrop(group, collection.id);

  return group;
}

// Create tab card for collection
function createCollectionTabCard(tab, collectionId) {
  const card = document.createElement('div');
  card.className = 'collection-tab-card';
  card.dataset.tabId = tab.id;
  card.dataset.collectionId = collectionId;

  // Create icon section
  const iconSection = document.createElement('div');
  iconSection.className = 'collection-tab-icon';

  const favicon = document.createElement('img');
  favicon.className = 'collection-tab-favicon';

  // Set a default icon first to ensure we always have something
  favicon.src = getDefaultIconPath();

  // Then try to load the actual favicon if available
  if (tab.favicon) {
    const tempImg = new Image();
    tempImg.onload = () => {
      favicon.src = tab.favicon;
    };
    tempImg.onerror = () => {
      // Keep the default icon if favicon fails to load
      favicon.src = getDefaultIconPath();
    };
    tempImg.src = tab.favicon;
  }

  // Fallback in case the above logic fails
  favicon.onerror = () => {
    favicon.src = getDefaultIconPath();
  };

  iconSection.appendChild(favicon);

  // Create info section
  const infoSection = document.createElement('div');
  infoSection.className = 'collection-tab-info';

  const title = document.createElement('div');
  title.className = 'collection-tab-title';
  title.textContent = tab.title;

  // Extract domain for subtitle
  let subtitle = '';
  try {
    const url = new URL(tab.url);
    subtitle = url.hostname.replace('www.', '');
  } catch (e) {
    subtitle = 'Unknown domain';
  }

  const subtitleElement = document.createElement('div');
  subtitleElement.className = 'collection-tab-subtitle';
  subtitleElement.textContent = subtitle;

  infoSection.appendChild(title);
  infoSection.appendChild(subtitleElement);

  // Create actions
  const actions = document.createElement('div');
  actions.className = 'collection-tab-actions';

  const openBtn = document.createElement('button');
  openBtn.className = 'collection-tab-btn';
  openBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  `;
  openBtn.title = 'Open tab';
  openBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openTabFromCollection(tab);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'collection-tab-btn delete';
  deleteBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  `;
  deleteBtn.title = 'Remove from collection';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeTabFromCollection(tab.id, collectionId);
    card.remove();
  });

  actions.appendChild(openBtn);
  actions.appendChild(deleteBtn);

  // Assemble the card
  card.appendChild(iconSection);
  card.appendChild(infoSection);
  card.appendChild(actions);

  // Open tab when card is clicked
  card.addEventListener('click', () => {
    openTabFromCollection(tab);
  });

  // Set up drag and drop for tabs
  dragDropService.setupTabDragDrop(card, tab.id, collectionId);

  return card;
}

// Render open tabs
function renderOpenTabs() {
  tabsContainer.innerHTML = '';

  currentTabs.forEach(tab => {
    const tabCard = createTabCard(tab);
    tabsContainer.appendChild(tabCard);
  });

  // Update tabs count
  tabsCount.textContent = currentTabs.length;
}

// Create tab card element
function createTabCard(tab) {
  const card = document.createElement('div');
  card.className = 'tab-card';
  card.dataset.tabId = tab.id;

  const favicon = document.createElement('img');
  favicon.className = 'tab-card-favicon';

  // Set a default icon first to ensure we always have something
  favicon.src = getDefaultIconPath();

  // Then try to load the actual favicon if available
  if (tab.favIconUrl) {
    const tempImg = new Image();
    tempImg.onload = () => {
      favicon.src = tab.favIconUrl;
    };
    tempImg.onerror = () => {
      // Keep the default icon if favicon fails to load
      favicon.src = getDefaultIconPath();
    };
    tempImg.src = tab.favIconUrl;
  }

  // Fallback in case the above logic fails
  favicon.onerror = () => {
    favicon.src = getDefaultIconPath();
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

  // Set up drag and drop for tabs
  dragDropService.setupTabDragDrop(card, tab.id, null); // null because it's not in a collection yet

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

  // Save all tabs button
  saveAllTabsBtn.addEventListener('click', () => {
    chrome.tabs.query({}, (tabs) => {
      showSaveModal(tabs);
    });
  });

  // New workspace button
  newWorkspaceBtn.addEventListener('click', () => {
    showWorkspaceModal();
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

  // Export data button
  exportDataBtn.addEventListener('click', () => {
    exportData();
  });

  // Import data button
  importDataBtn.addEventListener('click', () => {
    importDataFile.click();
  });

  // Import data file change
  importDataFile.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const jsonData = event.target.result;
          importData(jsonData);
        } catch (error) {
          console.error('Error reading file:', error);
          alert('Error reading file. Please try again.');
        }
      };

      reader.readAsText(file);
    }
  });

  // Tabs pane toggle button
  tabsToggleBtn.addEventListener('click', () => {
    toggleTabsPane();
  });

  // Close tabs pane button
  closeTabsPaneBtn.addEventListener('click', () => {
    closeTabsPane();
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

  // Setup workspace items click events
  const workspaceItems = workspacesList.querySelectorAll('.sidebar-item');
  workspaceItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active class from all items
      workspaceItems.forEach(i => i.classList.remove('active'));
      // Add active class to clicked item
      item.classList.add('active');
      // Set active workspace
      activeWorkspace = item.dataset.spaceId;
      // Load collections for this workspace
      loadCollections();
    });
  });

  // Setup drag and drop for collections list
  collectionsList.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  });

  collectionsList.addEventListener('drop', (e) => {
    e.preventDefault();
    const collectionId = e.dataTransfer.getData('text/plain');
    // Handle collection drop (could reorder or move to different workspace)
    console.log(`Collection ${collectionId} dropped`);
  });
}

// Perform search
async function performSearch(query) {
  if (!query) return;

  // First, try to search in our collections and tabs
  try {
    const results = await dataService.search(query);

    if (results.collections.length > 0 || results.tabs.length > 0) {
      // Show search results
      showSearchResults(results, query);
      return;
    }
  } catch (error) {
    console.error('Error searching:', error);
  }

  // If no results or error, search the web
  if (query.startsWith('http') || query.includes('.')) {
    // If the query looks like a URL, navigate to it
    chrome.tabs.create({ url: query.startsWith('http') ? query : `https://${query}` });
  } else {
    // Otherwise, search Google
    chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
  }

  searchInput.value = '';
}

// Show search results
function showSearchResults(results, query) {
  // Implement a search results UI
  alert(`Found ${results.collections.length} collections and ${results.tabs.length} tabs matching "${query}"`);

  // Clear search input
  searchInput.value = '';
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

    // Set a default icon first to ensure we always have something
    favicon.src = getDefaultIconPath();

    // Then try to load the actual favicon if available
    if (tab.favIconUrl) {
      const tempImg = new Image();
      tempImg.onload = () => {
        favicon.src = tab.favIconUrl;
      };
      tempImg.onerror = () => {
        // Keep the default icon if favicon fails to load
        favicon.src = getDefaultIconPath();
      };
      tempImg.src = tab.favIconUrl;
    }

    // Fallback in case the above logic fails
    favicon.onerror = () => {
      favicon.src = getDefaultIconPath();
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
function showShareModal(_, isTeamInvite = false) {
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
  emailsToShare = [];
}

// Show workspace modal
function showWorkspaceModal() {
  workspaceModal.classList.add('show');
  workspaceNameInput.value = '';
  workspaceColorInput.value = '#ff5c8d';
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
async function saveCollection() {
  const name = collectionNameInput.value.trim();
  const spaceId = collectionSpaceSelect.value;

  if (!name) {
    alert('Please enter a collection name');
    return;
  }

  try {
    // Format tabs for storage
    const tabs = selectedTabs.map(tab => {
      // Check if favicon is valid
      let favicon = getDefaultIconPath(); // Default fallback

      if (tab.favIconUrl) {
        // We'll store the original favicon URL, but we've already handled
        // displaying the default icon if it fails to load
        favicon = tab.favIconUrl;
      }

      return {
        id: `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        url: tab.url,
        title: tab.title,
        favicon: favicon
      };
    });

    // Create collection
    await dataService.createCollection(name, spaceId, tabs);

    // Reload collections
    await loadCollections();

    // Hide modal
    hideSaveModal();
  } catch (error) {
    console.error('Error saving collection:', error);
    alert('Error saving collection. Please try again.');
  }
}

// Open collection tabs
async function openCollection(collectionId) {
  try {
    const collection = await dataService.getCollection(collectionId);
    if (!collection || !collection.tabs || collection.tabs.length === 0) {
      alert('No tabs in this collection');
      return;
    }

    // Open all tabs in the collection
    collection.tabs.forEach(tab => {
      chrome.tabs.create({ url: tab.url });
    });
  } catch (error) {
    console.error('Error opening collection:', error);
    alert('Error opening collection. Please try again.');
  }
}

// Save settings
async function saveSettings() {
  try {
    const updatedPreferences = {
      theme: themeSelect.value,
      syncEnabled: syncEnabledCheck.checked,
      autoSaveEnabled: autoSaveEnabledCheck.checked,
      collaborationEnabled: collaborationEnabledCheck.checked,
      showRecent: showRecentCheck.checked,
      showWeather: showWeatherCheck.checked,
      showNotes: showNotesCheck.checked
    };

    // Update settings in database
    await dataService.updateSettings(updatedPreferences);

    // Update local state
    userPreferences = updatedPreferences;

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

    hideSettingsModal();

    // Refresh collections to update UI (if collaboration setting changed)
    await loadCollections();
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('Error saving settings. Please try again.');
  }
}

// Create workspace
async function createWorkspace() {
  const name = workspaceNameInput.value.trim();
  const color = workspaceColorInput.value;

  if (!name) {
    alert('Please enter a workspace name');
    return;
  }

  try {
    // Create workspace
    await dataService.createSpace(name, color);

    // Reload spaces
    await loadSpaces();

    // Hide modal
    hideWorkspaceModal();
  } catch (error) {
    console.error('Error creating workspace:', error);
    alert('Error creating workspace. Please try again.');
  }
}

// Share collection
function shareCollection() {
  if (emailsToShare.length === 0) {
    alert('Please add at least one email to share with');
    return;
  }

  // For now, just show a message since we don't have a backend for sharing
  alert(`Sharing is not implemented yet. Would share with: ${emailsToShare.join(', ')}`);

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

  const activeItem = Array.from(items).find(item => item.dataset.spaceId === workspaceId);
  if (activeItem) {
    activeItem.classList.add('active');
  }

  // Update collection space select
  collectionSpaceSelect.value = workspaceId;

  // Load collections for this workspace
  loadCollections();
}

// Sync tabs
function syncTabs() {
  if (!userPreferences.syncEnabled) {
    alert('Sync is disabled. Enable it in settings first.');
    return;
  }

  // Show syncing animation
  syncBtn.classList.add('syncing');

  // For now, just reload tabs
  loadOpenTabs();

  // Remove syncing animation after a delay
  setTimeout(() => {
    syncBtn.classList.remove('syncing');
  }, 1000);
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

// Helper function to get default icon path
function getDefaultIconPath() {
  return chrome.runtime.getURL('app/assets/icons/icon16.png');
}

// Toggle tabs pane
function toggleTabsPane() {
  if (tabsPane.classList.contains('open')) {
    closeTabsPane();
  } else {
    openTabsPane();
  }
}

// Open tabs pane
function openTabsPane() {
  tabsPane.classList.add('open');
  tabsToggleIcon.style.transform = 'rotate(180deg)';
}

// Close tabs pane
function closeTabsPane() {
  tabsPane.classList.remove('open');
  tabsToggleIcon.style.transform = 'rotate(0deg)';
}

// Toggle collection collapse
function toggleCollectionCollapse(collectionGroup) {
  collectionGroup.classList.toggle('collapsed');
}

// Open tab from collection
async function openTabFromCollection(tab) {
  try {
    // Check if tab is already open
    const openTabs = await new Promise(resolve => {
      chrome.tabs.query({}, tabs => resolve(tabs));
    });

    const openTab = openTabs.find(t => t.url === tab.url);

    if (openTab) {
      // If tab is already open, switch to it
      chrome.tabs.update(openTab.id, { active: true });
      chrome.windows.update(openTab.windowId, { focused: true });
    } else {
      // Otherwise, open a new tab
      chrome.tabs.create({ url: tab.url });
    }
  } catch (error) {
    console.error('Error opening tab:', error);
    // Fallback to just opening the URL
    chrome.tabs.create({ url: tab.url });
  }
}

// Remove tab from collection
async function removeTabFromCollection(tabId, collectionId) {
  try {
    await dataService.removeTabFromCollection(tabId, collectionId);
    // Update the tab count in the collection header
    const collection = await dataService.getCollection(collectionId);
    const collectionGroup = document.querySelector(`.collection-group[data-collection-id="${collectionId}"]`);
    if (collectionGroup) {
      const countElement = collectionGroup.querySelector('.collection-count');
      if (countElement) {
        const tabCount = collection.tabs ? collection.tabs.length : 0;
        countElement.textContent = `${tabCount} tab${tabCount !== 1 ? 's' : ''}`;
      }

      // If no tabs left, show empty message
      const content = collectionGroup.querySelector('.collection-content');
      if (content && (!collection.tabs || collection.tabs.length === 0)) {
        content.innerHTML = '';
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = 'No tabs in this collection';
        content.appendChild(emptyMessage);
      }
    }
  } catch (error) {
    console.error('Error removing tab from collection:', error);
  }
}

// Add export/import functions
async function exportData() {
  try {
    const data = await dataService.exportData();
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `toby-export-${new Date().toISOString().slice(0, 10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  } catch (error) {
    console.error('Error exporting data:', error);
    alert('Error exporting data. Please try again.');
  }
}

async function importData(jsonData) {
  try {
    const data = JSON.parse(jsonData);
    await dataService.importData(data);

    // Reload everything
    await loadSpaces();
    await loadCollections();

    alert('Data imported successfully!');
  } catch (error) {
    console.error('Error importing data:', error);
    alert('Error importing data. Please check the file format and try again.');
  }
}