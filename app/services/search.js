// app/services/search.js
import dataService from './data.js';

class SearchService {
  constructor() {
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    await dataService.init();
    this.initialized = true;
  }

  /**
   * Search tabs across all collections with filters
   * @param {string} query - The search query
   * @param {Object} filters - Optional filters
   * @param {string} filters.collectionName - Filter by collection name
   * @param {string} filters.spaceId - Filter by space ID
   * @param {string} filters.dateAdded - Filter by date added (format: 'today', 'week', 'month', 'year')
   * @param {string} filters.urlDomain - Filter by URL domain
   * @returns {Promise<Array>} - Array of search results with tab and collection info
   */
  async searchTabs(query, filters = {}) {
    await this.init();
    
    // Get all collections
    const collections = await dataService.getCollections();
    
    // Prepare results array
    const results = [];
    
    // Normalize query for case-insensitive search
    const normalizedQuery = query.toLowerCase();
    
    // Process each collection
    for (const collection of collections) {
      // Apply collection name filter if specified
      if (filters.collectionName && 
          !collection.name.toLowerCase().includes(filters.collectionName.toLowerCase())) {
        continue;
      }
      
      // Apply space filter if specified
      if (filters.spaceId && collection.spaceId !== filters.spaceId) {
        continue;
      }
      
      // Process tabs in this collection
      const tabs = collection.tabs || [];
      
      for (const tab of tabs) {
        // Check if tab matches the search query
        const titleMatch = tab.title && tab.title.toLowerCase().includes(normalizedQuery);
        const urlMatch = tab.url && tab.url.toLowerCase().includes(normalizedQuery);
        
        if (!titleMatch && !urlMatch && normalizedQuery.trim() !== '') {
          continue; // Skip if no match and we have a query
        }
        
        // Apply URL domain filter if specified
        if (filters.urlDomain) {
          const url = new URL(tab.url);
          const domain = url.hostname;
          if (!domain.includes(filters.urlDomain.toLowerCase())) {
            continue;
          }
        }
        
        // Apply date filter if specified
        if (filters.dateAdded) {
          const tabDate = new Date(tab.addedAt);
          const now = new Date();
          let valid = false;
          
          switch (filters.dateAdded) {
            case 'today':
              valid = tabDate.toDateString() === now.toDateString();
              break;
            case 'week':
              const weekAgo = new Date();
              weekAgo.setDate(now.getDate() - 7);
              valid = tabDate >= weekAgo;
              break;
            case 'month':
              const monthAgo = new Date();
              monthAgo.setMonth(now.getMonth() - 1);
              valid = tabDate >= monthAgo;
              break;
            case 'year':
              const yearAgo = new Date();
              yearAgo.setFullYear(now.getFullYear() - 1);
              valid = tabDate >= yearAgo;
              break;
            default:
              valid = true;
          }
          
          if (!valid) continue;
        }
        
        // Add to results
        results.push({
          tab,
          collection: {
            id: collection.id,
            name: collection.name,
            spaceId: collection.spaceId
          }
        });
      }
    }
    
    return results;
  }
  
  /**
   * Get available filter options based on current data
   * @returns {Promise<Object>} - Object containing filter options
   */
  async getFilterOptions() {
    await this.init();
    
    // Get all collections and spaces
    const collections = await dataService.getCollections();
    const spaces = await dataService.getSpaces();
    
    // Extract unique collection names
    const collectionNames = [...new Set(collections.map(c => c.name))];
    
    // Extract unique domains from all tabs
    const domains = new Set();
    collections.forEach(collection => {
      (collection.tabs || []).forEach(tab => {
        try {
          const url = new URL(tab.url);
          domains.add(url.hostname);
        } catch (e) {
          // Skip invalid URLs
        }
      });
    });
    
    return {
      collections: collectionNames,
      spaces,
      domains: [...domains],
      dateOptions: ['today', 'week', 'month', 'year']
    };
  }
}

// Create and export a singleton instance
const searchService = new SearchService();
export default searchService;