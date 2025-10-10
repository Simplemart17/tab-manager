// app/services/dragdrop.js
import dataService from './data.js';

class DragDropService {
  constructor() {
    this.draggedItem = null;
    this.draggedItemType = null;
    this.sourceContainerId = null;
    this.dragFeedbackElement = null;
  }

  // Set up drag and drop for a tab element
  setupTabDragDrop(tabElement, tabId, collectionId) {
    tabElement.setAttribute('draggable', 'true');

    tabElement.addEventListener('dragstart', (e) => {
      // Stop propagation to prevent parent elements from being dragged
      e.stopPropagation();
      this.handleTabDragStart(e, tabId, collectionId);
    });

    tabElement.addEventListener('dragend', (e) => {
      this.handleDragEnd(e);
    });
  }

  // Set up drag and drop for a collection element (header only, not the whole group)
  setupCollectionDragDrop(collectionHeader, collectionElement, collectionId) {
    // Make only the header draggable
    collectionHeader.setAttribute('draggable', 'true');

    collectionHeader.addEventListener('dragstart', (e) => {
      // Only allow dragging from the header, not from action buttons
      if (e.target.closest('.collection-action-btn') ||
          e.target.closest('.collection-toggle-icon')) {
        e.preventDefault();
        return;
      }
      this.handleCollectionDragStart(e, collectionId);
    });

    collectionHeader.addEventListener('dragend', (e) => {
      this.handleDragEnd(e);
    });

    // Make the entire collection element a drop target for tabs
    collectionElement.addEventListener('dragover', (e) => {
      this.handleDragOver(e);
    });

    collectionElement.addEventListener('dragenter', (e) => {
      this.handleDragEnter(e, collectionElement);
    });

    collectionElement.addEventListener('dragleave', (e) => {
      this.handleDragLeave(e, collectionElement);
    });

    collectionElement.addEventListener('drop', (e) => {
      this.handleCollectionDrop(e, collectionId);
    });
  }

  // Set up a space as a drop target for collections
  setupSpaceDropTarget(spaceElement, spaceId) {
    spaceElement.addEventListener('dragover', (e) => {
      this.handleDragOver(e);
    });

    spaceElement.addEventListener('dragenter', (e) => {
      this.handleDragEnter(e, spaceElement);
    });

    spaceElement.addEventListener('dragleave', (e) => {
      this.handleDragLeave(e, spaceElement);
    });

    spaceElement.addEventListener('drop', (e) => {
      this.handleSpaceDrop(e, spaceId);
    });
  }

  // Handle drag start for tabs
  handleTabDragStart(e, tabId, collectionId) {
    this.draggedItem = tabId;
    this.draggedItemType = 'tab';
    this.sourceContainerId = collectionId;

    // Set the data for the drag operation
    try {
      const data = JSON.stringify({
        type: 'tab',
        id: tabId,
        sourceId: collectionId
      });

      // Set data in multiple formats to ensure compatibility
      e.dataTransfer.setData('application/json', data);
      e.dataTransfer.setData('text/plain', data);
    } catch (error) {
      console.error('Error setting drag data:', error);
    }

    e.dataTransfer.effectAllowed = 'move';

    // Add a class to the element being dragged
    e.target.classList.add('dragging');

    // Create a visual drag feedback
    this.createDragFeedback(e, 'tab');

    // Set a custom drag image if supported
    if (e.dataTransfer.setDragImage && this.dragFeedbackElement) {
      e.dataTransfer.setDragImage(this.dragFeedbackElement, 15, 15);
    }
  }

  // Handle drag start for collections
  handleCollectionDragStart(e, collectionId) {
    this.draggedItem = collectionId;
    this.draggedItemType = 'collection';

    // Set the data for the drag operation
    try {
      const data = JSON.stringify({
        type: 'collection',
        id: collectionId
      });

      // Set data in multiple formats to ensure compatibility
      e.dataTransfer.setData('application/json', data);
      e.dataTransfer.setData('text/plain', data);
    } catch (error) {
      console.error('Error setting drag data:', error);
    }

    e.dataTransfer.effectAllowed = 'move';

    // Add a class to the element being dragged
    e.target.classList.add('dragging');

    // Create a visual drag feedback
    this.createDragFeedback(e, 'collection');

    // Set a custom drag image if supported
    if (e.dataTransfer.setDragImage && this.dragFeedbackElement) {
      e.dataTransfer.setDragImage(this.dragFeedbackElement, 20, 20);
    }
  }

  // Handle drag over
  handleDragOver(e) {
    // Prevent default to allow drop
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  // Handle drag enter
  handleDragEnter(_, element) {
    element.classList.add('drag-over');

    // Add visual indication based on compatibility
    if (this.draggedItemType === 'tab') {
      element.classList.add('can-drop-tab');
    } else if (this.draggedItemType === 'collection') {
      element.classList.add('can-drop-collection');
    }
  }

  // Handle drag leave
  handleDragLeave(_, element) {
    element.classList.remove('drag-over');
    element.classList.remove('can-drop-tab');
    element.classList.remove('can-drop-collection');
  }

  // Handle drag end
  handleDragEnd(e) {
    e.target.classList.remove('dragging');

    // Remove any drag feedback element
    if (this.dragFeedbackElement && this.dragFeedbackElement.parentNode) {
      document.body.removeChild(this.dragFeedbackElement);
      this.dragFeedbackElement = null;
    }

    // Remove any drag-over classes from all elements
    document.querySelectorAll('.drag-over, .can-drop-tab, .can-drop-collection').forEach(el => {
      el.classList.remove('drag-over');
      el.classList.remove('can-drop-tab');
      el.classList.remove('can-drop-collection');
    });

    // Reset drag state
    this.draggedItem = null;
    this.draggedItemType = null;
    this.sourceContainerId = null;
  }

  // Handle drop on a collection
  async handleCollectionDrop(e, targetCollectionId) {
    e.preventDefault();

    const dropEl = e.currentTarget;

    // Remove drag-over classes safely
    if (dropEl) {
      dropEl.classList.remove('drag-over');
      dropEl.classList.remove('can-drop-tab');
      dropEl.classList.remove('can-drop-collection');
    }

    try {
      // Try to get data from different formats
      let jsonData;
      try {
        jsonData = e.dataTransfer.getData('application/json');
      } catch (err) {
        // If application/json fails, try text/plain
        jsonData = e.dataTransfer.getData('text/plain');
      }

      // If we still don't have data, stop silently
      if (!jsonData) {
        return;
      }

      let data;
      try {
        data = JSON.parse(jsonData);
      } catch (_) {
        return;
      }

      // Only handle moving tabs between existing collections
      if (data.type !== 'tab' || !data.sourceId || data.sourceId === targetCollectionId) {
        return;
      }

      // Get source and target collection names for the notification
      const sourceCollection = await dataService.getCollection(data.sourceId);
      const targetCollection = await dataService.getCollection(targetCollectionId);

      if (!sourceCollection || !targetCollection) {
        return;
      }

      // Add visual feedback for the drop
      this.showDropFeedback(dropEl, 'success');

      // Move tab from one collection to another
      await dataService.moveTabBetweenCollections(data.sourceId, targetCollectionId, data.id);

      // Trigger an event to notify that data has changed
      this.dispatchDataChangeEvent();

      // Dispatch a custom event for the notification
      const notificationEvent = new CustomEvent('sim-tab-moved', {
        detail: {
          sourceCollection: sourceCollection?.name || 'Unknown collection',
          targetCollection: targetCollection?.name || 'Unknown collection'
        }
      });
      document.dispatchEvent(notificationEvent);
    } catch (error) {
      console.error('Error handling collection drop:', error);
      this.showDropFeedback(dropEl, 'error');
    }
  }

  // Handle drop on a space
  async handleSpaceDrop(e, targetSpaceId) {
    e.preventDefault();

    // Remove drag-over class
    e.currentTarget.classList.remove('drag-over');

    try {
      // Try to get data from different formats
      let jsonData;
      try {
        jsonData = e.dataTransfer.getData('application/json');
      } catch (err) {
        // If application/json fails, try text/plain
        jsonData = e.dataTransfer.getData('text/plain');
      }

      // If we still don't have data, throw an error
      if (!jsonData) {
        throw new Error('No valid data found in drop event');
      }

      const data = JSON.parse(jsonData);

      if (data.type === 'collection') {
        // Add visual feedback for the drop
        this.showDropFeedback(e.currentTarget, 'success');

        // Move collection to a different space
        await dataService.updateCollection(data.id, { spaceId: targetSpaceId });

        // Trigger an event to notify that data has changed
        this.dispatchDataChangeEvent();
      }
    } catch (error) {
      console.error('Error handling space drop:', error);
      this.showDropFeedback(e.currentTarget, 'error');
    }
  }

  // Dispatch a custom event when data changes due to drag and drop
  dispatchDataChangeEvent() {
    const event = new CustomEvent('sim-data-change');
    document.dispatchEvent(event);
  }

  /**
   * Create a visual feedback element for dragging
   * @param {DragEvent} e - The drag event
   * @param {string} type - The type of element being dragged ('tab' or 'collection')
   */
  createDragFeedback(e, type) {
    // Remove any existing feedback element
    if (this.dragFeedbackElement && this.dragFeedbackElement.parentNode) {
      document.body.removeChild(this.dragFeedbackElement);
    }

    // Create a new feedback element
    this.dragFeedbackElement = document.createElement('div');
    this.dragFeedbackElement.className = `drag-feedback drag-feedback-${type}`;

    // Add content based on type
    if (type === 'tab') {
      // Try to get title from either tab-title or collection-tab-title
      const title = e.target.querySelector('.tab-title')?.textContent ||
                   e.target.querySelector('.collection-tab-title')?.textContent || 'Tab';

      // Try to get favicon from either tab-favicon or collection-tab-favicon
      const favicon = e.target.querySelector('.tab-favicon')?.cloneNode(true) ||
                     e.target.querySelector('.collection-tab-favicon')?.cloneNode(true) || '';

      if (favicon) {
        this.dragFeedbackElement.appendChild(favicon);
      }

      const titleSpan = document.createElement('span');
      titleSpan.textContent = title.length > 20 ? title.substring(0, 20) + '...' : title;
      this.dragFeedbackElement.appendChild(titleSpan);
    } else if (type === 'collection') {
      const title = e.target.querySelector('.collection-name')?.textContent ||
                   e.target.querySelector('.collection-title')?.textContent || 'Collection';

      const icon = document.createElement('div');
      icon.className = 'collection-icon';
      this.dragFeedbackElement.appendChild(icon);

      const titleSpan = document.createElement('span');
      titleSpan.textContent = title.length > 15 ? title.substring(0, 15) + '...' : title;
      this.dragFeedbackElement.appendChild(titleSpan);
    }

    // Add to document but make it invisible
    this.dragFeedbackElement.style.position = 'absolute';
    this.dragFeedbackElement.style.top = '-1000px';
    this.dragFeedbackElement.style.left = '-1000px';
    document.body.appendChild(this.dragFeedbackElement);
  }

  /**
   * Show visual feedback after a drop operation
   * @param {HTMLElement} element - The element where the drop occurred
   * @param {string} status - The status of the drop ('success' or 'error')
   */
  showDropFeedback(element, status) {
    if (!element) return;
    // Add appropriate class
    element.classList.add(`drop-${status}`);

    // Remove class after animation completes
    setTimeout(() => {
      element.classList.remove(`drop-${status}`);
    }, 800);
  }
}

// Create and export a singleton instance
const dragDropService = new DragDropService();
export default dragDropService;
