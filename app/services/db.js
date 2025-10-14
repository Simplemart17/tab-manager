// app/services/db.js
class IndexedDBService {
  constructor() {
    this.dbName = 'TabManager';
    this.dbVersion = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains('spaces')) {
          const spacesStore = db.createObjectStore('spaces', { keyPath: 'id' });
          spacesStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('collections')) {
          const collectionsStore = db.createObjectStore('collections', { keyPath: 'id' });
          collectionsStore.createIndex('spaceId', 'spaceId', { unique: false });
          collectionsStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(`Database error: ${event.target.error}`);
      };
    });
  }

  // Spaces CRUD operations
  async getSpaces() {
    return this.getAll('spaces');
  }

  async getSpace(id) {
    return this.get('spaces', id);
  }

  async addSpace(space) {
    return this.add('spaces', space);
  }

  async updateSpace(space) {
    return this.update('spaces', space);
  }

  async deleteSpace(id) {
    return this.delete('spaces', id);
  }

  // Collections CRUD operations
  async getCollections() {
    return this.getAll('collections');
  }

  async getCollectionsBySpace(spaceId) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['collections'], 'readonly');
      const store = transaction.objectStore('collections');
      const index = store.index('spaceId');
      const request = index.getAll(spaceId);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        reject(`Error getting collections by space: ${event.target.error}`);
      };
    });
  }

  async getCollection(id) {
    return this.get('collections', id);
  }

  async addCollection(collection) {
    return this.add('collections', collection);
  }

  async updateCollection(collection) {
    return this.update('collections', collection);
  }

  async deleteCollection(id) {
    return this.delete('collections', id);
  }

  // Settings operations
  async getSettings() {
    const settings = await this.get('settings', 'userSettings');
    if (!settings) {
      const defaultSettings = {
        id: 'userSettings',
        theme: 'light',
        autoSaveEnabled: true
      };
      await this.add('settings', defaultSettings);
      return defaultSettings;
    }
    return settings;
  }

  async updateSettings(settings) {
    return this.update('settings', { ...settings, id: 'userSettings' });
  }

  // Generic CRUD operations
  async getAll(storeName) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        reject(`Error getting all from ${storeName}: ${event.target.error}`);
      };
    });
  }

  async get(storeName, id) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (event) => {
        reject(`Error getting from ${storeName}: ${event.target.error}`);
      };
    });
  }

  async add(storeName, item) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(item);

      request.onsuccess = () => {
        resolve(item);
      };

      request.onerror = (event) => {
        reject(`Error adding to ${storeName}: ${event.target.error}`);
      };
    });
  }

  async update(storeName, item) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => {
        resolve(item);
      };

      request.onerror = (event) => {
        reject(`Error updating in ${storeName}: ${event.target.error}`);
      };
    });
  }

  async delete(storeName, id) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = (event) => {
        reject(`Error deleting from ${storeName}: ${event.target.error}`);
      };
    });
  }

  // Search functionality
  async search(query) {
    const collections = await this.getAll('collections');
    const results = {
      collections: [],
      tabs: []
    };

    const lowerQuery = query.toLowerCase();

    // Search in collection names
    results.collections = collections.filter(collection =>
      collection.name.toLowerCase().includes(lowerQuery)
    );

    // Search in tabs
    collections.forEach(collection => {
      if (!collection.tabs) return;

      const matchingTabs = collection.tabs.filter(tab =>
        tab.title.toLowerCase().includes(lowerQuery) ||
        tab.url.toLowerCase().includes(lowerQuery)
      );

      if (matchingTabs.length > 0) {
        results.tabs.push(...matchingTabs.map(tab => ({
          ...tab,
          collectionId: collection.id,
          collectionName: collection.name
        })));
      }
    });

    return results;
  }
}

// Create and export a singleton instance
const dbService = new IndexedDBService();
export default dbService;
