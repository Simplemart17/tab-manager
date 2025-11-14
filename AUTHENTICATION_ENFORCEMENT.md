# Authentication Enforcement - Simple Tab Plus

## Overview
Simple Tab Plus is now **strictly for authenticated users**. All users must log in before using the app. Unauthenticated users are automatically redirected to the authentication page.

## Authentication Flow

### 1. **New Tab Page (newtab.html)**
- When a user opens a new tab, `newtab.js` immediately checks authentication
- If not authenticated, user is redirected to `auth.html#signin`
- Authentication check includes retry logic (3 attempts with 1-second delays)
- Session is monitored every 5 minutes; expired sessions trigger re-login

### 2. **Popup (popup.html)**
- When popup is opened, authentication is checked
- If not authenticated, the app opens the new tab page and closes the popup
- This ensures users always go through the auth flow

### 3. **Auth Page (auth.html)**
- Provides sign-in and sign-up options
- If user is already authenticated, they're redirected to the app immediately
- Uses Supabase for authentication

### 4. **Background Service (background.js)**
- Handles all authentication operations (sign up, sign in, sign out)
- Validates sessions on startup
- Enforces authentication before any sync operations

## Key Changes Made

### Files Modified:
1. **app/background.js**
   - Added authentication requirement documentation
   - Ensures `pullAll()` is called on login regardless of sync settings
   - Ensures `pullAll()` is called on startup for authenticated users

2. **app/utils/newtab.js**
   - Added authentication requirement documentation
   - Enforces authentication check with retry logic
   - Redirects unauthenticated users to login page

3. **app/services/data.js**
   - Updated comments to reflect authentication requirement
   - Removed references to "offline mode"
   - All data operations now assume authenticated user

## Data Sync Behavior

- **On Login**: User's cloud data is automatically pulled to the device
- **On Startup**: If user is authenticated, their data is pulled from cloud
- **On Data Changes**: Local changes are automatically synced to cloud
- **Daily Sync**: Background sync runs every 24 hours (bidirectional)
- **Manual Sync**: Sync button performs immediate bidirectional sync

## Security Notes

- All users must authenticate with Supabase
- Session tokens are stored securely in Chrome storage
- Sessions are validated regularly
- Expired sessions trigger automatic re-login
- All data is encrypted in transit (HTTPS/WSS)
- Row-level security policies enforce user data isolation in Supabase

## User Experience

1. User opens extension → Redirected to login if not authenticated
2. User signs in/up → Data is pulled from cloud
3. User makes changes → Changes sync immediately to cloud
4. User opens app on new device → All data is available after login
5. User's session expires → Automatic redirect to login page

