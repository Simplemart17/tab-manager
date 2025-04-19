// app/services/dragdrop.js
import dataService from './data.js';

class DragDropService {
  constructor() {
    this.draggedItem = null;
    this.draggedItemType = null;
    this.sourceContainerId = null;
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
  }

  // Handle drag leave
  handleDragLeave(e, element) {
    element.classList.remove('drag-over');
  }

  // Handle drag end
  handleDragEnd(e) {
    e.target.classList.remove('dragging');
    
    // Reset drag state
    this.draggedItem = null;
    this.draggedItemType = null;
    this.sourceContainerId = null;
  }

  // Handle drop on a collection
  async handleCollectionDrop(e, targetCollectionId) {
    e.preventDefault();
    
    // Remove drag-over class
    e.currentTarget.classList.remove('drag-over');
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      
      if (data.type === 'tab' && data.sourceId !== targetCollectionId) {
        // Move tab from one collection to another
        await dataService.moveTabBetweenCollections(data.sourceId, targetCollectionId, data.id);
        
        // Trigger an event to notify that data has changed
        this.dispatchDataChangeEvent();
      }
    } catch (error) {
      console.error('Error handling collection drop:', error);
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
}

// Create and export a singleton instance
const dragDropService = new DragDropService();
export default dragDropService;
