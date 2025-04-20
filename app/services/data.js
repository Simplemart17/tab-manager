// app/services/data.js
import dbService from './db.js';

class DataService {
  constructor() {
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    await dbService.init();

    // Initialize default spaces if none exist
    const spaces = await dbService.getSpaces();
    if (spaces.length === 0) {
      await this.createDefaultSpaces();
    }

    this.initialized = true;
  }

  async createDefaultSpaces() {
    const defaultSpace = { id: 'personal', name: 'Personal', color: '#914CE6', createdAt: Date.now() };
    await dbService.addSpace(defaultSpace);
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

  async createSpace(name, color) {
    await this.init();
    const space = {
      id: `space-${Date.now()}`,
      name,
      color,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    return dbService.addSpace(space);
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

    return dbService.updateSpace(updatedSpace);
  }

  async deleteSpace(id) {
    await this.init();
    // First, get all collections in this space
    const collections = await dbService.getCollectionsBySpace(id);

    // Delete all collections in this space
    for (const collection of collections) {
      await dbService.deleteCollection(collection.id);
    }

    // Delete the space
    return dbService.deleteSpace(id);
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
      id: `collection-${Date.now()}`,
      name,
      spaceId,
      tabs,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    return dbService.addCollection(collection);
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

    return dbService.updateCollection(updatedCollection);
  }

  async deleteCollection(id) {
    await this.init();
    return dbService.deleteCollection(id);
  }

  async addTabToCollection(collectionId, tab) {
    await this.init();
    const collection = await dbService.getCollection(collectionId);
    if (!collection) throw new Error(`Collection with id ${collectionId} not found`);

    const tabToAdd = {
      id: `tab-${Date.now()}`,
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

    return dbService.updateCollection(updatedCollection);
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

    return dbService.updateCollection(updatedCollection);
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
    return dbService.updateCollection(updatedTargetCollection);
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

    // Clear existing data
    const existingSpaces = await dbService.getSpaces();
    for (const space of existingSpaces) {
      await dbService.deleteSpace(space.id);
    }

    const existingCollections = await dbService.getCollections();
    for (const collection of existingCollections) {
      await dbService.deleteCollection(collection.id);
    }

    // Determine the format and process accordingly
    if (data.groups && Array.isArray(data.groups)) {
      // This is the custom format with groups, lists, and cards
      return this._importCustomFormat(data);
    } else if (data.spaces && data.collections) {
      // Import spaces
      for (const space of data.spaces) {
        await dbService.addSpace(space);
      }

      // Import collections
      for (const collection of data.collections) {
        await dbService.addCollection(collection);
      }

      // Import settings if available
      if (data.settings) {
        await dbService.updateSettings(data.settings);
      }

      return { success: true };
    } else {
      throw new Error('Unrecognized data format for import');
    }
  }

  // Private method for importing custom format
  async _importCustomFormat(data) {
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

      // Create a space for this group
      const spaceId = `space-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const space = {
        id: spaceId,
        name: group.name,
        color: this.getRandomColor(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await dbService.addSpace(space);
      stats.spaces++;

      // Process each list (collection) in the space
      for (const list of group.lists) {
        if (!list.title || !list.cards || !Array.isArray(list.cards)) {
          continue;
        }

        // Format tabs from cards
        const tabs = list.cards.map(card => {
          if (!card.url) {
            return null;
          }

          stats.tabs++;

          return {
            id: `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            url: card.url,
            title: card.title || card.url,
            favicon: card.favicon || '',
            description: card.description || '',
            createdAt: Date.now()
          };
        }).filter(tab => tab !== null); // Remove any invalid tabs

        // Create collection
        const collection = {
          id: `collection-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: list.title,
          tabs,
          spaceId,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await dbService.addCollection(collection);
        stats.collections++;
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
