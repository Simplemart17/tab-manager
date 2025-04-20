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
      this.handleTabDragStart(e, tabId, collectionId);
    });

    tabElement.addEventListener('dragend', (e) => {
      this.handleDragEnd(e);
    });
  }

  // Set up drag and drop for a collection element
  setupCollectionDragDrop(collectionElement, collectionId) {
    collectionElement.setAttribute('draggable', 'true');

    collectionElement.addEventListener('dragstart', (e) => {
      this.handleCollectionDragStart(e, collectionId);
    });

    collectionElement.addEventListener('dragend', (e) => {
      this.handleDragEnd(e);
    });

    // Make collection a drop target for tabs
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

    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'tab',
      id: tabId,
      sourceId: collectionId
    }));

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

    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'collection',
      id: collectionId
    }));

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
  handleDragEnter(e, element) {
    element.classList.add('drag-over');
    
    // Add visual indication based on compatibility
    if (this.draggedItemType === 'tab') {
      element.classList.add('can-drop-tab');
    } else if (this.draggedItemType === 'collection') {
      element.classList.add('can-drop-collection');
    }
  }

  // Handle drag leave
  handleDragLeave(e, element) {
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

    // Remove drag-over classes
    e.currentTarget.classList.remove('drag-over');
    e.currentTarget.classList.remove('can-drop-tab');
    e.currentTarget.classList.remove('can-drop-collection');

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));

      if (data.type === 'tab' && data.sourceId !== targetCollectionId) {
        // Get source and target collection names for the notification
        const sourceCollection = await dataService.getCollection(data.sourceId);
        const targetCollection = await dataService.getCollection(targetCollectionId);

        // Add visual feedback for the drop
        this.showDropFeedback(e.currentTarget, 'success');

        // Move tab from one collection to another
        await dataService.moveTabBetweenCollections(data.sourceId, targetCollectionId, data.id);

        // Trigger an event to notify that data has changed
        this.dispatchDataChangeEvent();

        // Dispatch a custom event for the notification
        const notificationEvent = new CustomEvent('toby-tab-moved', {
          detail: {
            sourceCollection: sourceCollection?.name || 'Unknown collection',
            targetCollection: targetCollection?.name || 'Unknown collection'
          }
        });
        document.dispatchEvent(notificationEvent);
      }
    } catch (error) {
      console.error('Error handling collection drop:', error);
      this.showDropFeedback(e.currentTarget, 'error');
    }
  }

  // Handle drop on a space
  async handleSpaceDrop(e, targetSpaceId) {
    e.preventDefault();

    // Remove drag-over class
    e.currentTarget.classList.remove('drag-over');

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));

      if (data.type === 'collection') {
        // Move collection to a different space
        await dataService.updateCollection(data.id, { spaceId: targetSpaceId });

        // Trigger an event to notify that data has changed
        this.dispatchDataChangeEvent();
      }
    } catch (error) {
      console.error('Error handling space drop:', error);
    }
  }

  // Dispatch a custom event when data changes due to drag and drop
  dispatchDataChangeEvent() {
    const event = new CustomEvent('toby-data-change');
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
      const title = e.target.querySelector('.tab-title')?.textContent || 'Tab';
      const favicon = e.target.querySelector('.tab-favicon')?.cloneNode(true) || '';
      
      if (favicon) {
        this.dragFeedbackElement.appendChild(favicon);
      }
      
      const titleSpan = document.createElement('span');
      titleSpan.textContent = title.length > 20 ? title.substring(0, 20) + '...' : title;
      this.dragFeedbackElement.appendChild(titleSpan);
    } else if (type === 'collection') {
      const title = e.target.querySelector('.collection-name')?.textContent || 'Collection';
      
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
