// New Tab script for Simple Tab Manager
import dataService from '../services/data.js';
import dragDropService from '../services/dragdrop.js';
import searchService from '../services/search.js';
import searchFilters from '../components/search-filters.js';

// DOM Elements
const collectionsList = document.getElementById('collections-list');
const tabsContainer = document.getElementById('tabs-container');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchFiltersContainer = document.createElement('div');
searchFiltersContainer.className = 'search-filters-container';
const searchContainer = document.querySelector('.search-container');
searchContainer.appendChild(searchFiltersContainer);
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


// Save Collection Modal Elements
const newCollectionOption = document.getElementById('new-collection-option');
const existingCollectionOption = document.getElementById('existing-collection-option');
const newCollectionForm = document.getElementById('new-collection-form');
const existingCollectionForm = document.getElementById('existing-collection-form');
const existingCollectionSelect = document.getElementById('existing-collection-select');

// Tabs Pane Elements
const tabsPane = document.getElementById('tabs-pane');
const tabsToggleBtn = document.getElementById('tabs-toggle-btn');
const closeTabsPaneBtn = document.getElementById('close-tabs-pane');
const tabsCount = document.querySelector('.tabs-count');
const tabsToggleIcon = document.querySelector('.tabs-toggle-icon');

// Modals
const saveCollectionModal = document.getElementById('save-collection-modal');
const settingsModal = document.getElementById('settings-modal');
const workspaceModal = document.getElementById('workspace-modal');

// Save Collection Modal
const collectionNameInput = document.getElementById('collection-name');
const selectedTabsList = document.getElementById('selected-tabs');
const cancelSaveBtn = document.getElementById('cancel-save');
const confirmSaveBtn = document.getElementById('confirm-save');

// Settings Modal
const themeSelect = document.getElementById('theme-select');
const autoSaveEnabledCheck = document.getElementById('auto-save-enabled');
const cancelSettingsBtn = document.getElementById('cancel-settings');
const saveSettingsBtn = document.getElementById('save-settings');



// Workspace Modal
const workspaceNameInput = document.getElementById('workspace-name');
const workspaceColorInput = document.getElementById('workspace-color');
const cancelWorkspaceBtn = document.getElementById('cancel-workspace');
const confirmWorkspaceBtn = document.getElementById('confirm-workspace');

// State
let currentTabs = [];
let selectedTabs = [];
let activeWorkspace = 'personal';
let userPreferences = {
  theme: 'light',
  autoSaveEnabled: true
};
let isSearchActive = false;
let searchResults = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Add click event listener to document to close tabs pane when clicking outside
    document.addEventListener('click', (e) => {
      // Check if tabs pane is open
      if (tabsPane.classList.contains('open')) {
        // Check if the click is outside the tabs pane and not on the toggle button
        if (!tabsPane.contains(e.target) && !tabsToggleBtn.contains(e.target)) {
          closeTabsPane();
        }
      }
    });
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

    // Initialize search filters
    await searchFilters.init(searchFiltersContainer, searchInput, (searchData) => {
      searchTabsAndCollections(searchData.query);
    });

    // Listen for data changes from drag and drop operations
    document.addEventListener('sim-data-change', async () => {
      await loadCollections();
    });

    // Listen for tab moved events
    document.addEventListener('sim-tab-moved', (e) => {
      const { sourceCollection, targetCollection } = e.detail;
      showNotification(`Tab moved from "${sourceCollection}" to "${targetCollection}"`);
    });

    // Listen for tab updates
    chrome.tabs.onCreated.addListener(() => {
      loadOpenTabs();
    });

    chrome.tabs.onRemoved.addListener(() => {
      loadOpenTabs();
    });

    // Only listen for completed tab updates to avoid excessive calls
    chrome.tabs.onUpdated.addListener((_, changeInfo) => {
      // Only reload tabs when the tab has completed loading or the URL has changed
      if (changeInfo.status === 'complete' || changeInfo.url) {
        loadOpenTabs();
      }
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
    } else if (userPreferences.theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (userPreferences.theme === 'system') {
      const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
      if (prefersDarkScheme.matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }

    // Update form elements
    themeSelect.value = userPreferences.theme;
    autoSaveEnabledCheck.checked = userPreferences.autoSaveEnabled;
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
    // If search is active, show search results instead
    if (isSearchActive) {
      renderSearchResults();
      return;
    }

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
      searchTabsAndCollections(searchInput.value);
    }
  });

  searchBtn.addEventListener('click', () => {
    searchTabsAndCollections(searchInput.value);
  });

  // Handle search input changes (debounced)
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (isSearchActive || searchInput.value.trim()) {
        searchTabsAndCollections(searchInput.value);
      }
    }, 300);
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
    // Handle collection drop (could reorder or move to different workspace)
    // Collection dropped
  });
}

// Search tabs and collections
async function searchTabsAndCollections(query) {
  if (!query.trim() && Object.keys(searchFilters.getActiveFilters().filters).length === 0) {
    // If search is empty and no filters are active, exit search mode
    isSearchActive = false;
    loadCollections();
    return;
  }

  // First, try to search in our collections and tabs
  try {
    // Use the new search service with current filters
    isSearchActive = true;
    const { filters } = searchFilters.getActiveFilters();
    searchResults = await searchService.searchTabs(query, filters);

    // Display search results
    renderSearchResults();
    return;
  } catch (error) {
    console.error('Error searching tabs and collections:', error);
  }

  // If no results found and we have a query (not just filters), search the web
  if (query.trim()) {
    searchWeb(query);
  }
}

// Search the web
function searchWeb(query) {
  // Open a new tab with the search query
  chrome.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(query)}` });
}

// Render search results
function renderSearchResults() {
  // Clear collections list
  collectionsList.innerHTML = '';

  // Create search results header
  const searchHeader = document.createElement('div');
  searchHeader.className = 'search-results-header';
  searchHeader.innerHTML = `
    <h2>Search Results</h2>
    <span class="result-count">${searchResults.length} results</span>
    <button class="clear-search-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
      Clear Search
    </button>
  `;

  // Add clear search button event
  searchHeader.querySelector('.clear-search-btn').addEventListener('click', () => {
    searchInput.value = '';
    searchFilters.clearFilters();
    isSearchActive = false;
    loadCollections();
  });

  collectionsList.appendChild(searchHeader);

  // Group results by collection
  const resultsByCollection = {};

  searchResults.forEach(result => {
    const collectionId = result.collection.id;
    if (!resultsByCollection[collectionId]) {
      resultsByCollection[collectionId] = {
        collection: result.collection,
        tabs: []
      };
    }
    resultsByCollection[collectionId].tabs.push(result.tab);
  });

  // Create a collection card for each group
  Object.values(resultsByCollection).forEach(group => {
    const collectionCard = createCollectionGroup({
      id: group.collection.id,
      name: group.collection.name,
      tabs: group.tabs,
      spaceId: group.collection.spaceId
    });

    collectionsList.appendChild(collectionCard);
  });

  // If no results, show empty state
  if (searchResults.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-search-results';
    emptyState.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        <line x1="8" y1="11" x2="14" y2="11"></line>
      </svg>
      <h3>No results found</h3>
      <p>Try adjusting your search or filters</p>
    `;

    collectionsList.appendChild(emptyState);
  }
}

// Show save collection modal
async function showSaveModal(tabs) {
  selectedTabs = tabs;

  // Clear previous data
  collectionNameInput.value = '';
  selectedTabsList.innerHTML = '';
  collectionSpaceSelect.value = activeWorkspace;

  // Reset save options
  newCollectionOption.checked = true;
  existingCollectionOption.checked = false;
  newCollectionForm.style.display = 'block';
  existingCollectionForm.style.display = 'none';

  // Set up event listeners for the radio buttons
  newCollectionOption.addEventListener('change', () => {
    if (newCollectionOption.checked) {
      newCollectionForm.style.display = 'block';
      existingCollectionForm.style.display = 'none';
    }
  });

  existingCollectionOption.addEventListener('change', () => {
    if (existingCollectionOption.checked) {
      newCollectionForm.style.display = 'none';
      existingCollectionForm.style.display = 'block';
    }
  });

  // Populate existing collections dropdown
  existingCollectionSelect.innerHTML = '<option value="">Select a collection...</option>';
  try {
    const collections = await dataService.getCollections();
    collections.forEach(collection => {
      const option = document.createElement('option');
      option.value = collection.id;
      option.textContent = collection.name;
      existingCollectionSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading collections for dropdown:', error);
  }

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



// Save collection
async function saveCollection() {
  // Check if we're saving to a new or existing collection
  const saveToExisting = existingCollectionOption.checked;

  if (saveToExisting) {
    // Save to existing collection
    const collectionId = existingCollectionSelect.value;

    if (!collectionId) {
      alert('Please select a collection');
      return;
    }

    if (selectedTabs.length === 0) {
      alert('No tabs selected');
      return;
    }

    try {
      // Get the existing collection
      const existingCollection = await dataService.getCollection(collectionId);

      if (!existingCollection) {
        throw new Error('Collection not found');
      }

      // Format tabs for storage
      const newTabs = selectedTabs.map(tab => {
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

      // Add new tabs to existing collection
      const updatedTabs = [...(existingCollection.tabs || []), ...newTabs];

      // Update the collection in the database
      await dataService.updateCollection(collectionId, { tabs: updatedTabs });

      // Reload collections
      await loadCollections();

      // Hide modal
      hideSaveModal();

      // Show success message
      showNotification('Tabs added to collection successfully');
    } catch (error) {
      console.error('Error adding tabs to collection:', error);
      alert('Error adding tabs to collection. Please try again.');
    }
  } else {
    // Save as new collection
    const name = collectionNameInput.value.trim();
    const spaceId = collectionSpaceSelect.value;

    if (!name) {
      alert('Please enter a collection name');
      return;
    }

    if (selectedTabs.length === 0) {
      alert('No tabs selected');
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

      // Show success message
      showNotification('Collection saved successfully');
    } catch (error) {
      console.error('Error saving collection:', error);
      alert('Error saving collection. Please try again.');
    }
  }
}



// Save settings
async function saveSettings() {
  try {
    const updatedPreferences = {
      theme: themeSelect.value,
      autoSaveEnabled: autoSaveEnabledCheck.checked
    };

    // Update settings in database
    await dataService.updateSettings(updatedPreferences);

    // Update local state
    userPreferences = updatedPreferences;

    // Apply theme
    if (userPreferences.theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (userPreferences.theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (userPreferences.theme === 'system') {
      const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
      if (prefersDarkScheme.matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }

    hideSettingsModal();

    // Show success notification
    showNotification('Settings saved successfully');
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
  // Show syncing animation
  syncBtn.classList.add('syncing');

  // Reload tabs
  loadOpenTabs();

  // Remove syncing animation after a delay
  setTimeout(() => {
    syncBtn.classList.remove('syncing');
  }, 1000);
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

    const exportFileDefaultName = `tab-export-${new Date().toISOString().slice(0, 10)}.json`;

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

    // Determine the format of the imported data
    if (data.groups && Array.isArray(data.groups)) {
      // This is the custom format with groups, lists, and cards
      const stats = await dataService._importCustomFormat(data);

      // Reload everything
      await loadSpaces();
      await loadCollections();

      showNotification(`Import successful! Added ${stats.spaces} spaces, ${stats.collections} collections, and ${stats.tabs} tabs.`);
    } else if (data.spaces && data.collections) {
      await dataService.importData(data);

      // Reload everything
      await loadSpaces();
      await loadCollections();

      showNotification('Data imported successfully!');
    } else {
      throw new Error('Unrecognized data format');
    }
  } catch (error) {
    console.error('Error importing data:', error);
    alert(`Error importing data: ${error.message}. Please check the file format and try again.`);
  }
}

// Show notification
function showNotification(message, type = 'success') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'notification-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => {
    notification.remove();
  });

  notification.appendChild(closeBtn);

  // Add to document
  document.body.appendChild(notification);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}