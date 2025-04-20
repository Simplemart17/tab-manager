# Tab Manager

A Chrome extension for efficient tab management with a clean, modern interface.

## Features

- **Tab Organization**: Save and organize your browser tabs into collections
- **Workspaces (Spaces)**: Organize collections into different workspaces with custom colors
- **Beautiful New Tab Page**: Replace Chrome's new tab with a productivity dashboard
- **Dark Mode**: Choose between light, dark, or system theme
- **Search**: Quickly find tabs, collections, or search the web
- **Drag & Drop**: Easily organize tabs with drag and drop
- **Export/Import**: Backup and restore your tab collections

## Technical Details

### Core Components

- **Popup Interface**: Quick access to tabs and collections from the toolbar
- **New Tab Dashboard**: Full-featured management interface
- **Background Service**: Handles tab events and synchronization
- **Data Service**: Manages persistent storage of tabs and collections

### User Interface

- Modern, clean design with customizable themes
- Responsive layout that works across different screen sizes
- Intuitive drag-and-drop functionality for organizing tabs
- Modal dialogs for creating and editing collections and workspaces

### Data Management

- Local storage for tabs, collections, and user preferences
- Efficient data structure for quick access and updates
- Import/export functionality for data backup

## Installation

### Development Installation

1. Clone this repository:
```
git clone https://github.com/yourusername/tab-manager.git
```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the directory where you cloned the repository

5. The extension should now be installed and active

### Usage

- Click on the extension icon in your toolbar to access the popup interface
- Navigate to a new tab to see the full dashboard
- Create collections by clicking "New Collection"
- Organize collections into spaces using the sidebar
- Configure settings by clicking the gear icon

## Future Enhancements

- **Tab Statistics**: Add usage analytics to track tab habits
- **Keyboard Shortcuts**: Expand keyboard navigation for power users
- **Tab Groups Integration**: Support for Chrome's native tab groups
- **Notes & Tags**: Add notes and tags to collections for better organization
- **Improved Drag & Drop**: Enhanced UI for drag and drop operations
- **Browser Sync**: Optional sync across browsers using a cloud service
- **Performance Optimization**: Improve loading times for large collections
- **Extension Backup**: Cloud backup option for extension data
- **Custom Themes**: Allow users to create and share custom themes

## License

MIT