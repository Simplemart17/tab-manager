// app/services/data.js
import dbService from './db.js';
import { getSupabase, getCurrentUser } from './supabaseClient.js';

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

async function deleteWorkspaceFromSupabase(space) {
  try {
    const supabase = getSupabase();
    if (!supabase || !space || !space.name) return;

    const user = await getCurrentUser();
    if (!user) return;

    // Find remote workspaces for this user and space name
    const { data: wsRows, error: wsErr } = await supabase
      .from('workspaces')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', space.name);

    if (wsErr) {
      console.warn('Failed to load remote workspace for deletion:', wsErr.message || wsErr);
      return;
    }

    if (!wsRows || wsRows.length === 0) return;

    const workspaceIds = wsRows.map((w) => w.id);

    // Load collections attached to these workspaces
    const { data: collRows, error: collErr } = await supabase
      .from('collections')
      .select('id')
      .eq('user_id', user.id)
      .in('workspace_id', workspaceIds);

    if (collErr) {
      console.warn('Failed to load remote collections for workspace deletion:', collErr.message || collErr);
    } else if (collRows && collRows.length) {
      const collectionIds = collRows.map((c) => c.id);

      // Delete tabs in these collections
      const { error: tabsErr } = await supabase
        .from('tabs')
        .delete()
        .in('collection_id', collectionIds)
        .eq('user_id', user.id);
      if (tabsErr) {
        console.warn('Failed to delete remote tabs for workspace:', tabsErr.message || tabsErr);
      }

      // Delete collections themselves
      const { error: collDelErr } = await supabase
        .from('collections')
        .delete()
        .in('id', collectionIds)
        .eq('user_id', user.id);
      if (collDelErr) {
        console.warn('Failed to delete remote collections for workspace:', collDelErr.message || collDelErr);
      }
    }

    // Finally delete workspace records
    const { error: wsDelErr } = await supabase
      .from('workspaces')
      .delete()
      .in('id', workspaceIds)
      .eq('user_id', user.id);
    if (wsDelErr) {
      console.warn('Failed to delete remote workspace:', wsDelErr.message || wsDelErr);
    }
  } catch (error) {
    console.warn('Error deleting workspace from Supabase:', error?.message || error);
  }
}



class DataService {
  constructor() {
    this.initialized = false;
    this.syncInProgress = false;
  }

  async init() {
    if (this.initialized) return;

    await dbService.init();

    this.initialized = true;
  }

  /**
   * Immediate dual-sync: Syncs data to both IndexedDB and Supabase immediately
   * This is called after every data operation (create, update, delete, move)
   * Non-blocking - errors are logged but don't disrupt user operations
   */
  async immediateDualSync() {
    // Prevent multiple concurrent syncs
    if (this.syncInProgress) return;

    this.syncInProgress = true;
    try {
      // Trigger sync via background script to avoid circular dependencies
      // The background script has access to sync-service.js
      chrome.runtime.sendMessage({ action: 'immediateSyncTabs' }, (response) => {
        if (response?.error) {
          console.warn('Immediate sync failed:', response.error);
        }
      });
    } catch (error) {
      console.warn('Immediate sync error:', error.message);
    } finally {
      this.syncInProgress = false;
    }
  }

  async createDefaultSpaces() {
    const defaults = [];
    for (const s of defaults) {
      await dbService.addSpace(s);
    }
  }

  // Spaces methods
  async getSpaces() {
    await this.init();
    return dbService.getSpaces();
  }

  async getSpace(id) {
    await this.init();
    return dbService.getSpace(id);
  }

  async createSpace(name, color, icon = 'briefcase') {
    await this.init();
    const space = {
      id: generateUuid(),
      name,
      color,
      icon,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const result = await dbService.addSpace(space);

    // Immediate dual-sync to Supabase
    this.immediateDualSync();

    return result;
  }

  async updateSpace(id, updates) {
    await this.init();
    const space = await dbService.getSpace(id);
    if (!space) throw new Error(`Space with id ${id} not found`);

    const updatedSpace = {
      ...space,
      ...updates,
      updatedAt: Date.now()
    };

    const result = await dbService.updateSpace(updatedSpace);

    // Immediate dual-sync to Supabase
    this.immediateDualSync();

    return result;
  }

  async deleteSpace(id) {
    await this.init();

    // Capture the space before deleting for remote cleanup
    const space = await dbService.getSpace(id);

    // First, get all collections in this space
    const collections = await dbService.getCollectionsBySpace(id);

    // Delete all collections in this space
    for (const collection of collections) {
      await dbService.deleteCollection(collection.id);
    }

    // Delete the space locally
    const result = await dbService.deleteSpace(id);

    // Best-effort delete of corresponding workspace, collections and tabs from Supabase
    if (space) {
      await deleteWorkspaceFromSupabase(space);
    }

    // Immediate dual-sync to Supabase
    this.immediateDualSync();

    return result;
  }

  async deleteSpaceWithMigration(spaceId, targetSpaceId) {
    await this.init();

    // Capture the space before deleting so we can clean it up in Supabase
    const space = await dbService.getSpace(spaceId);

    // Validate that target space exists (when provided)
    if (targetSpaceId) {
      const targetSpace = await dbService.getSpace(targetSpaceId);
      if (!targetSpace) {
        throw new Error(`Target space with id ${targetSpaceId} not found`);
      }
    }

    // Get all collections in the space to be deleted
    const collections = await dbService.getCollectionsBySpace(spaceId);

    if (targetSpaceId) {
      // Migrate collections to target space
      for (const collection of collections) {
        await dbService.updateCollection({
          ...collection,
          spaceId: targetSpaceId,
          updatedAt: Date.now()
        });
      }
    } else {
      // Delete all collections if no target space specified
      for (const collection of collections) {
        await dbService.deleteCollection(collection.id);
      }
    }

    // Delete the space locally
    const result = await dbService.deleteSpace(spaceId);

    // Best-effort delete of corresponding workspace (and its collections/tabs) from Supabase
    if (space) {
      await deleteWorkspaceFromSupabase(space);
    }

    // Immediate dual-sync to Supabase
    this.immediateDualSync();

    return result;
  }

  async migrateCollectionsToSpace(sourceSpaceId, targetSpaceId) {
    await this.init();

    const targetSpace = await dbService.getSpace(targetSpaceId);
    if (!targetSpace) {
      throw new Error(`Target space with id ${targetSpaceId} not found`);
    }

    const collections = await dbService.getCollectionsBySpace(sourceSpaceId);

    for (const collection of collections) {
      await dbService.updateCollection({
        ...collection,
        spaceId: targetSpaceId,
        updatedAt: Date.now()
      });
    }

    // Immediate dual-sync to Supabase
    this.immediateDualSync();

    return collections.length;
  }

  // Collections methods
  async getCollections() {
    await this.init();
    return dbService.getCollections();
  }

  async getCollection(id) {
    await this.init();
    return dbService.getCollection(id);
  }

  async getCollectionsBySpace(spaceId) {
    await this.init();
    return dbService.getCollectionsBySpace(spaceId);
  }

  async createCollection(name, spaceId, tabs = []) {
    await this.init();
    const collection = {
      id: generateUuid(),
      name,
      spaceId,
      tabs,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const result = await dbService.addCollection(collection);

    // Immediate dual-sync to Supabase
    this.immediateDualSync();

    return result;
  }

  async updateCollection(id, updates) {
    await this.init();
    const collection = await dbService.getCollection(id);
    if (!collection) throw new Error(`Collection with id ${id} not found`);

    const updatedCollection = {
      ...collection,
      ...updates,
      updatedAt: Date.now()
    };

    const result = await dbService.updateCollection(updatedCollection);

    // Immediate dual-sync to Supabase
    this.immediateDualSync();

    return result;
  }

  async deleteCollection(id) {
    await this.init();

    // Delete locally first
    const result = await dbService.deleteCollection(id);

    // Best-effort delete in Supabase so pullAll does not resurrect it
    try {
      const supabase = getSupabase();
      if (supabase) {
        const user = await getCurrentUser();
        if (user) {
          // Delete tabs for this collection
          const { error: tabsErr } = await supabase
            .from('tabs')
            .delete()
            .eq('collection_id', id)
            .eq('user_id', user.id);
          if (tabsErr) {
            console.warn('Failed to delete remote tabs for collection:', tabsErr.message || tabsErr);
          }

          // Delete the collection row itself
          const { error: collErr } = await supabase
            .from('collections')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
          if (collErr) {
            console.warn('Failed to delete remote collection:', collErr.message || collErr);
          }
        }
      }
    } catch (error) {
      console.warn('Error deleting collection from Supabase:', error?.message || error);
    }

    // Immediate dual-sync to Supabase
    this.immediateDualSync();

    return result;
  }

  async addTabToCollection(collectionId, tab) {
    await this.init();
    const collection = await dbService.getCollection(collectionId);
    if (!collection) throw new Error(`Collection with id ${collectionId} not found`);

    const tabToAdd = {
      id: generateUuid(),
      url: tab.url,
      title: tab.title,
      favicon: tab.favIconUrl || tab.favicon || '',
      addedAt: Date.now()
    };

    const updatedCollection = {
      ...collection,
      tabs: [...(collection.tabs || []), tabToAdd],
      updatedAt: Date.now()
    };

    const result = await dbService.updateCollection(updatedCollection);

    // Immediate dual-sync to Supabase
    this.immediateDualSync();

    return result;
  }

  async removeTabFromCollection(tabId, collectionId) {
    await this.init();
    const collection = await dbService.getCollection(collectionId);
    if (!collection) throw new Error(`Collection with id ${collectionId} not found`);

    const updatedCollection = {
      ...collection,
      tabs: (collection.tabs || []).filter(tab => tab.id !== tabId),
      updatedAt: Date.now()
    };

    const result = await dbService.updateCollection(updatedCollection);

    // Immediate dual-sync to Supabase
    this.immediateDualSync();

    return result;
  }

  async moveTabBetweenCollections(sourceCollectionId, targetCollectionId, tabId) {
    await this.init();
    const sourceCollection = await dbService.getCollection(sourceCollectionId);
    if (!sourceCollection) throw new Error(`Source collection with id ${sourceCollectionId} not found`);

    const targetCollection = await dbService.getCollection(targetCollectionId);
    if (!targetCollection) throw new Error(`Target collection with id ${targetCollectionId} not found`);

    // Find the tab to move
    const tabIndex = (sourceCollection.tabs || []).findIndex(tab => tab.id === tabId);
    if (tabIndex === -1) throw new Error(`Tab with id ${tabId} not found in source collection`);

    const tabToMove = sourceCollection.tabs[tabIndex];

    // Remove from source collection
    const updatedSourceCollection = {
      ...sourceCollection,
      tabs: sourceCollection.tabs.filter(tab => tab.id !== tabId),
      updatedAt: Date.now()
    };

    // Add to target collection
    const updatedTargetCollection = {
      ...targetCollection,
      tabs: [...(targetCollection.tabs || []), tabToMove],
      updatedAt: Date.now()
    };

    // Update both collections
    await dbService.updateCollection(updatedSourceCollection);
    const result = await dbService.updateCollection(updatedTargetCollection);

    // Immediate dual-sync to Supabase
    this.immediateDualSync();

    return result;
  }

  // Settings methods
  async getSettings() {
    await this.init();
    return dbService.getSettings();
  }

  async updateSettings(updates) {
    await this.init();
    const settings = await dbService.getSettings();
    const updatedSettings = { ...settings, ...updates };
    return dbService.updateSettings(updatedSettings);
  }

  // Search method
  async search(query) {
    await this.init();
    return dbService.search(query);
  }

  // Import/Export methods
  async exportData() {
    await this.init();
    const spaces = await dbService.getSpaces();
    const collections = await dbService.getCollections();
    const settings = await dbService.getSettings();

    return {
      spaces,
      collections,
      settings,
      exportDate: new Date().toISOString()
    };
  }

  async importData(data) {
    await this.init();

    // Get existing data for duplicate detection
    const existingSpaces = await dbService.getSpaces();
    const existingCollections = await dbService.getCollections();

    // Create maps for quick lookup
    const existingSpacesByName = {};
    const existingSpacesById = {};
    for (const space of existingSpaces) {
      existingSpacesByName[space.name.toLowerCase()] = space;
      existingSpacesById[space.id] = space;
    }

    const existingCollectionsById = {};
    for (const collection of existingCollections) {
      existingCollectionsById[collection.id] = collection;
    }

    let result;

    // Determine the format and process accordingly
    if (data.groups && Array.isArray(data.groups)) {
      // This is the custom format with groups, lists, and cards
      result = await this._importCustomFormat(data, existingSpacesByName, existingCollectionsById);
    } else if (data.spaces && data.collections) {
      // Create a map of old space IDs to new space IDs for handling old export formats
      const spaceIdMap = {};

      // Import spaces (skip duplicates by name)
      let spacesAdded = 0;
      for (const space of data.spaces) {
        const spaceName = space.name.toLowerCase();
        let targetSpace;

        if (existingSpacesByName[spaceName]) {
          // Space with this name already exists
          targetSpace = existingSpacesByName[spaceName];
        } else {
          // Create new space with default icon if not provided
          const spaceToAdd = {
            ...space,
            icon: space.icon || 'briefcase'
          };
          await dbService.addSpace(spaceToAdd);
          targetSpace = spaceToAdd;
          existingSpacesByName[spaceName] = spaceToAdd;
          existingSpacesById[spaceToAdd.id] = spaceToAdd;
          spacesAdded++;
        }

        // Map old space ID to new space ID (for old export formats)
        spaceIdMap[space.id] = targetSpace.id;
      }

      // Import collections (skip duplicates by ID, merge tabs)
      let collectionsAdded = 0;
      let tabsAdded = 0;
      for (const collection of data.collections) {
        const existingCollection = existingCollectionsById[collection.id];

        // Handle space ID mapping for old export formats
        let collectionSpaceId = collection.spaceId;
        if (spaceIdMap[collectionSpaceId]) {
          collectionSpaceId = spaceIdMap[collectionSpaceId];
        }

        // Verify the space exists, if not find a default space
        if (!existingSpacesById[collectionSpaceId]) {
          // Try to find a space by name from the imported spaces
          const importedSpace = data.spaces.find(s => s.id === collection.spaceId);
          if (importedSpace && existingSpacesByName[importedSpace.name.toLowerCase()]) {
            collectionSpaceId = existingSpacesByName[importedSpace.name.toLowerCase()].id;
          } else if (existingSpaces.length > 0) {
            // Use first existing space as fallback
            collectionSpaceId = existingSpaces[0].id;
          } else {
            // Skip this collection if no space is available
            console.warn(`Skipping collection ${collection.id}: no valid space found`);
            continue;
          }
        }

        if (existingCollection) {
          // Collection exists - merge tabs (avoid duplicates by URL)
          const existingTabUrls = new Set(
            (existingCollection.tabs || []).map(t => t.url.toLowerCase())
          );

          const newTabs = (collection.tabs || []).filter(
            tab => !existingTabUrls.has(tab.url.toLowerCase())
          );

          if (newTabs.length > 0) {
            const updatedTabs = [...(existingCollection.tabs || []), ...newTabs];
            await dbService.updateCollection({
              ...existingCollection,
              tabs: updatedTabs,
              updatedAt: Date.now()
            });
            tabsAdded += newTabs.length;
          }
        } else {
          // New collection - add it with corrected spaceId
          const collectionToAdd = {
            ...collection,
            spaceId: collectionSpaceId
          };
          await dbService.addCollection(collectionToAdd);
          existingCollectionsById[collection.id] = collectionToAdd;
          collectionsAdded++;
          tabsAdded += (collection.tabs || []).length;
        }
      }

      // Import settings if available (merge, don't overwrite)
      if (data.settings) {
        const currentSettings = await dbService.getSettings();
        await dbService.updateSettings({ ...currentSettings, ...data.settings });
      }

      result = {
        success: true,
        spacesAdded,
        collectionsAdded,
        tabsAdded,
        message: `Added ${spacesAdded} spaces, ${collectionsAdded} collections, and ${tabsAdded} tabs. Duplicates were skipped.`
      };
    } else {
      throw new Error('Unrecognized data format for import');
    }

    // Trigger sync to Supabase immediately after import via background script
    try {
      chrome.runtime.sendMessage({ action: 'syncTabs' }, (response) => {
        if (response?.error) {
          console.warn('Failed to sync imported data:', response.error);
        }
      });
    } catch (error) {
      console.warn('Failed to trigger sync for imported data:', error.message);
    }

    return result;
  }

  // Private method for importing custom format
  async _importCustomFormat(data, existingSpacesByName = {}, existingCollectionsById = {}) {
    await this.init();

    // Validate data structure
    if (!data.groups || !Array.isArray(data.groups)) {
      throw new Error('Invalid data format: missing or invalid groups array');
    }

    // Track created spaces and collections for reporting
    const stats = {
      spaces: 0,
      collections: 0,
      tabs: 0
    };

    // Process each group (space)
    for (const group of data.groups) {
      if (!group.name || !group.lists || !Array.isArray(group.lists)) {
        continue;
      }

      // Check if space already exists by name
      const spaceName = group.name.toLowerCase();
      let spaceId;

      if (existingSpacesByName[spaceName]) {
        // Use existing space
        spaceId = existingSpacesByName[spaceName].id;
      } else {
        // Create a new space for this group
        spaceId = generateUuid();
        const space = {
          id: spaceId,
          name: group.name,
          color: this.getRandomColor(),
          icon: 'briefcase',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await dbService.addSpace(space);
        existingSpacesByName[spaceName] = space;
        stats.spaces++;
      }

      // Process each list (collection) in the space
      for (const list of group.lists) {
        if (!list.title || !list.cards || !Array.isArray(list.cards)) {
          continue;
        }

        // Format tabs from cards (filter out invalid ones)
        const tabs = list.cards
          .filter(card => card.url)
          .map(card => ({
            id: generateUuid(),
            url: card.url,
            title: card.title || card.url,
            favicon: card.favicon || '',
            description: card.description || '',
            createdAt: Date.now()
          }));

        // Create a unique collection ID
        const collectionId = generateUuid();

        // Check if a collection with similar name exists in this space
        const existingCollectionInSpace = Object.values(existingCollectionsById).find(
          c => c.spaceId === spaceId && c.name.toLowerCase() === list.title.toLowerCase()
        );

        if (existingCollectionInSpace) {
          // Merge tabs into existing collection (avoid duplicates by URL)
          const existingTabUrls = new Set(
            (existingCollectionInSpace.tabs || []).map(t => t.url.toLowerCase())
          );

          const newTabs = tabs.filter(tab => !existingTabUrls.has(tab.url.toLowerCase()));

          if (newTabs.length > 0) {
            const updatedTabs = [...(existingCollectionInSpace.tabs || []), ...newTabs];
            await dbService.updateCollection({
              ...existingCollectionInSpace,
              tabs: updatedTabs,
              updatedAt: Date.now()
            });
            stats.tabs += newTabs.length;
          }
        } else {
          // Create new collection
          const collection = {
            id: collectionId,
            name: list.title,
            tabs,
            spaceId,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };

          await dbService.addCollection(collection);
          existingCollectionsById[collectionId] = collection;
          stats.collections++;
          stats.tabs += tabs.length;
        }
      }
    }

    return stats;
  }

  // Helper method to generate random colors for spaces
  getRandomColor() {
    const colors = [
      '#914CE6', // Primary purple
      '#4ECDC4', // Accent teal
      '#FF6B6B', // Red
      '#FFD166', // Yellow
      '#06D6A0', // Green
      '#118AB2', // Blue
      '#5E60CE', // Indigo
      '#7209B7', // Violet
      '#F72585', // Pink
      '#3A86FF'  // Light blue
    ];

    return colors[Math.floor(Math.random() * colors.length)];
  }
}

// Create and export a singleton instance
const dataService = new DataService();
export default dataService;
