// app/components/search-filters.js
import searchService from '../services/search.js';

class SearchFilters {
  constructor() {
    this.filtersContainer = null;
    this.searchInput = null;
    this.activeFilters = {};
    this.filterOptions = null;
    this.onFilterChange = null;
  }

  /**
   * Initialize the search filters component
   * @param {HTMLElement} container - The container to render filters in
   * @param {HTMLInputElement} searchInput - The search input element
   * @param {Function} onFilterChange - Callback when filters change
   */
  async init(container, searchInput, onFilterChange) {
    this.filtersContainer = container;
    this.searchInput = searchInput;
    this.onFilterChange = onFilterChange;
    
    // Get filter options from search service
    this.filterOptions = await searchService.getFilterOptions();
    
    // Create filter UI
    this.renderFilters();
    
    // Set up search input event listener
    this.setupSearchListener();
  }

  /**
   * Render the filter UI
   */
  renderFilters() {
    if (!this.filtersContainer) return;
    
    // Clear existing content
    this.filtersContainer.innerHTML = '';
    
    // Create filter toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'filter-toggle-btn';
    toggleBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
      </svg>
      <span>Filters</span>
      <span class="filter-count"></span>
    `;
    
    // Create filters panel
    const filtersPanel = document.createElement('div');
    filtersPanel.className = 'filters-panel';
    filtersPanel.style.display = 'none';
    
    // Add filter groups
    filtersPanel.appendChild(this.createCollectionFilter());
    filtersPanel.appendChild(this.createSpaceFilter());
    filtersPanel.appendChild(this.createDateFilter());
    filtersPanel.appendChild(this.createDomainFilter());
    
    // Add clear filters button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'clear-filters-btn';
    clearBtn.textContent = 'Clear Filters';
    clearBtn.addEventListener('click', () => this.clearFilters());
    filtersPanel.appendChild(clearBtn);
    
    // Add toggle behavior
    toggleBtn.addEventListener('click', () => {
      const isVisible = filtersPanel.style.display !== 'none';
      filtersPanel.style.display = isVisible ? 'none' : 'block';
      toggleBtn.classList.toggle('active', !isVisible);
    });
    
    // Add to container
    this.filtersContainer.appendChild(toggleBtn);
    this.filtersContainer.appendChild(filtersPanel);
    
    // Update filter count
    this.updateFilterCount();
  }

  /**
   * Create collection name filter
   */
  createCollectionFilter() {
    const group = document.createElement('div');
    group.className = 'filter-group';
    
    const label = document.createElement('label');
    label.textContent = 'Collection';
    
    const select = document.createElement('select');
    select.id = 'filter-collection';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'All Collections';
    select.appendChild(defaultOption);
    
    // Add collection options
    this.filterOptions.collections.forEach(collection => {
      const option = document.createElement('option');
      option.value = collection;
      option.textContent = collection;
      select.appendChild(option);
    });
    
    // Add change event
    select.addEventListener('change', () => {
      if (select.value) {
        this.activeFilters.collectionName = select.value;
      } else {
        delete this.activeFilters.collectionName;
      }
      
      this.updateFilterCount();
      this.triggerFilterChange();
    });
    
    group.appendChild(label);
    group.appendChild(select);
    
    return group;
  }

  /**
   * Create space filter
   */
  createSpaceFilter() {
    const group = document.createElement('div');
    group.className = 'filter-group';
    
    const label = document.createElement('label');
    label.textContent = 'Space';
    
    const select = document.createElement('select');
    select.id = 'filter-space';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'All Spaces';
    select.appendChild(defaultOption);
    
    // Add space options
    this.filterOptions.spaces.forEach(space => {
      const option = document.createElement('option');
      option.value = space.id;
      option.textContent = space.name;
      select.appendChild(option);
    });
    
    // Add change event
    select.addEventListener('change', () => {
      if (select.value) {
        this.activeFilters.spaceId = select.value;
      } else {
        delete this.activeFilters.spaceId;
      }
      
      this.updateFilterCount();
      this.triggerFilterChange();
    });
    
    group.appendChild(label);
    group.appendChild(select);
    
    return group;
  }

  /**
   * Create date filter
   */
  createDateFilter() {
    const group = document.createElement('div');
    group.className = 'filter-group';
    
    const label = document.createElement('label');
    label.textContent = 'Date Added';
    
    const select = document.createElement('select');
    select.id = 'filter-date';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Any Time';
    select.appendChild(defaultOption);
    
    // Add date options
    const dateLabels = {
      'today': 'Today',
      'week': 'Past Week',
      'month': 'Past Month',
      'year': 'Past Year'
    };
    
    this.filterOptions.dateOptions.forEach(option => {
      const optionEl = document.createElement('option');
      optionEl.value = option;
      optionEl.textContent = dateLabels[option] || option;
      select.appendChild(optionEl);
    });
    
    // Add change event
    select.addEventListener('change', () => {
      if (select.value) {
        this.activeFilters.dateAdded = select.value;
      } else {
        delete this.activeFilters.dateAdded;
      }
      
      this.updateFilterCount();
      this.triggerFilterChange();
    });
    
    group.appendChild(label);
    group.appendChild(select);
    
    return group;
  }

  /**
   * Create domain filter
   */
  createDomainFilter() {
    const group = document.createElement('div');
    group.className = 'filter-group';
    
    const label = document.createElement('label');
    label.textContent = 'Website';
    
    const select = document.createElement('select');
    select.id = 'filter-domain';
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'All Websites';
    select.appendChild(defaultOption);
    
    // Add domain options
    this.filterOptions.domains.forEach(domain => {
      const option = document.createElement('option');
      option.value = domain;
      option.textContent = domain;
      select.appendChild(option);
    });
    
    // Add change event
    select.addEventListener('change', () => {
      if (select.value) {
        this.activeFilters.urlDomain = select.value;
      } else {
        delete this.activeFilters.urlDomain;
      }
      
      this.updateFilterCount();
      this.triggerFilterChange();
    });
    
    group.appendChild(label);
    group.appendChild(select);
    
    return group;
  }

  /**
   * Set up search input listener
   */
  setupSearchListener() {
    if (!this.searchInput) return;
    
    this.searchInput.addEventListener('input', () => {
      this.triggerFilterChange();
    });
  }

  /**
   * Update the filter count badge
   */
  updateFilterCount() {
    const count = Object.keys(this.activeFilters).length;
    const countEl = this.filtersContainer.querySelector('.filter-count');
    
    if (countEl) {
      if (count > 0) {
        countEl.textContent = count;
        countEl.style.display = 'inline-flex';
      } else {
        countEl.style.display = 'none';
      }
    }
    
    // Update toggle button appearance
    const toggleBtn = this.filtersContainer.querySelector('.filter-toggle-btn');
    if (toggleBtn) {
      toggleBtn.classList.toggle('has-filters', count > 0);
    }
  }

  /**
   * Clear all active filters
   */
  clearFilters() {
    this.activeFilters = {};
    
    // Reset all select elements
    const selects = this.filtersContainer.querySelectorAll('select');
    selects.forEach(select => {
      select.value = '';
    });
    
    this.updateFilterCount();
    this.triggerFilterChange();
  }

  /**
   * Trigger the filter change callback
   */
  triggerFilterChange() {
    if (this.onFilterChange) {
      this.onFilterChange({
        query: this.searchInput ? this.searchInput.value : '',
        filters: this.activeFilters
      });
    }
  }

  /**
   * Get the current active filters
   */
  getActiveFilters() {
    return {
      query: this.searchInput ? this.searchInput.value : '',
      filters: this.activeFilters
    };
  }
}

// Create and export a singleton instance
const searchFilters = new SearchFilters();
export default searchFilters;