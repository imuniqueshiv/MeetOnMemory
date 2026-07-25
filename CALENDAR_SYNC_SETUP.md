# Calendar Two-Way Sync Setup Guide

This guide explains how to set up Google Calendar and Microsoft Outlook two-way synchronization for MeetOnMemory.

## Overview

The calendar sync feature allows users to:
- Connect their Google Calendar and/or Microsoft Outlook accounts
- Automatically sync meetings created in MeetOnMemory to connected calendars
- View external calendar events in the MeetOnMemory dashboard
- Check attendee availability using the scheduling assistant
- Sync external calendar changes back to MeetOnMemory (background job)

## Prerequisites

- Node.js and npm installed
- MeetOnMemory project cloned and running
- Google Cloud Console account (for Google Calendar)
- Microsoft Azure account (for Microsoft Outlook)

## Step 1: Set Up Google Calendar OAuth

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### 1.2 Create OAuth 2.0 Credentials

1. Navigate to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application" as the application type
4. Configure the following:
   - **Name**: MeetOnMemory Calendar Sync
   - **Authorized redirect URIs**: 
     - `http://localhost:4000/api/calendar/google/callback` (development)
     - `https://your-domain.com/api/calendar/google/callback` (production)
5. Click "Create"
6. Copy the **Client ID** and **Client Secret**

### 1.3 Configure OAuth Consent Screen

1. Navigate to "APIs & Services" > "OAuth consent screen"
2. Select "External" user type
3. Fill in the required information:
   - App name: MeetOnMemory
   - User support email: your-email@example.com
   - Developer contact: your-email@example.com
4. Add required scopes:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
5. Save and publish the consent screen

## Step 2: Set Up Microsoft Graph OAuth

### 2.1 Register Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Microsoft Entra ID" (formerly Azure Active Directory)
3. Click "App registrations" > "New registration"
4. Configure the following:
   - **Name**: MeetOnMemory Calendar Sync
   - **Supported account types**: "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI**: 
     - `http://localhost:4000/api/calendar/microsoft/callback` (development)
     - `https://your-domain.com/api/calendar/microsoft/callback` (production)
5. Click "Register"
6. Copy the **Application (client) ID** and **Directory (tenant) ID**

### 2.2 Create Client Secret

1. In the app registration, navigate to "Certificates & secrets"
2. Click "New client secret"
3. Add a description and expiration period
4. Click "Add"
5. **Important**: Copy the secret value immediately (you won't see it again)

### 2.3 Configure API Permissions

1. Navigate to "API permissions" in your app registration
2. Click "Add a permission" > "Microsoft Graph"
3. Select "Delegated permissions"
4. Add the following permissions:
   - `Calendars.ReadWrite`
   - `User.Read`
5. Click "Add permissions"
6. Click "Grant admin consent for [your organization]" (required for production)

## Step 3: Configure Environment Variables

Add the following variables to your `.env` file in the server directory:

```env
# Google Calendar Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/calendar/google/callback

# Microsoft Graph Configuration
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret
MICROSOFT_REDIRECT_URI=http://localhost:4000/api/calendar/microsoft/callback
MICROSOFT_TENANT_ID=common

# Token Encryption (generate a secure random string, minimum 32 characters)
CALENDAR_ENCRYPTION_KEY=your_secure_encryption_key_minimum_32_characters_long
```

### Generate Encryption Key

You can generate a secure encryption key using Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 4: Install Dependencies

Navigate to the server directory and install the new dependencies:

```bash
cd server
npm install @azure/msal-node crypto-js
```

## Step 5: Restart the Server

Restart your MeetOnMemory server to load the new calendar sync functionality:

```bash
npm start
```

You should see the following log message:
```
Starting calendar sync job (interval: 15 minutes)
```

## Step 6: Test the Integration

### 6.1 Connect Google Calendar

1. Log in to MeetOnMemory
2. Navigate to Settings
3. Find the "Calendar Integrations" section
4. Click "Connect" next to Google Calendar
5. Authorize the application in the OAuth popup
6. Verify the connection status shows "Connected"

### 6.2 Connect Microsoft Outlook

1. In the same Settings page
2. Click "Connect" next to Microsoft Outlook
3. Authorize the application in the OAuth popup
4. Verify the connection status shows "Connected"

### 6.3 Test Two-Way Sync

1. Create a new meeting in MeetOnMemory
2. Check your Google Calendar/Outlook - the meeting should appear
3. Edit the meeting in MeetOnMemory
4. Verify the update reflects in your external calendar
5. Cancel the meeting in MeetOnMemory
6. Verify the event is removed from your external calendar

### 6.4 Test External Events Display

1. Navigate to the Calendar page in MeetOnMemory
2. Enable the "External Events" toggle
3. Verify events from your connected calendars appear in the calendar view
4. External events should be styled in purple with a cloud icon

### 6.5 Test Free/Busy Availability

1. Navigate to Create Meeting
2. Add participants with email addresses
3. Select a date
4. View the availability grid showing free/busy slots
5. Click on an available slot to select it

## Troubleshooting

### OAuth Connection Fails

**Problem**: OAuth popup shows an error or doesn't redirect properly.

**Solutions**:
- Verify redirect URIs match exactly (including http/https and port)
- Check that the consent screen is published
- Ensure API permissions are granted (for Microsoft)
- Check browser console for specific error messages

### Events Not Syncing

**Problem**: Meetings created in MeetOnMemory don't appear in external calendars.

**Solutions**:
- Check server logs for sync errors
- Verify environment variables are set correctly
- Ensure tokens are not expired (check connection status)
- Try manual resync from Settings page

### External Events Not Displaying

**Problem**: External calendar events don't appear in the Calendar view.

**Solutions**:
- Enable the "External Events" toggle in the Calendar page
- Check that the calendar connection is active
- Verify the date range includes events
- Check browser console for API errors

### Token Refresh Errors

**Problem**: Calendar connection shows "Re-authentication required".

**Solutions**:
- Disconnect and reconnect the calendar
- Verify refresh token is being stored correctly
- Check that OAuth consent includes offline access

## Security Considerations

1. **Encryption**: All tokens are encrypted using AES encryption before storage
2. **HTTPS**: Use HTTPS in production for OAuth redirects
3. **Secret Management**: Never commit `.env` files to version control
4. **Token Rotation**: The system automatically refreshes expired tokens
5. **Scope Limitation**: Only request necessary calendar permissions

## Background Sync Job

The calendar sync job runs every 15 minutes to:
- Fetch external calendar events
- Sync external changes to MeetOnMemory
- Handle conflict resolution (last modified wins)
- Update connection status and error tracking

You can manually trigger a sync from the Settings page using the resync button.

## API Endpoints

### Calendar Connection Management

- `GET /api/calendar/status` - Get connection status
- `GET /api/calendar/google/auth-url` - Get Google OAuth URL
- `POST /api/calendar/google/callback` - Handle Google OAuth callback
- `GET /api/calendar/microsoft/auth-url` - Get Microsoft OAuth URL
- `POST /api/calendar/microsoft/callback` - Handle Microsoft OAuth callback
- `DELETE /api/calendar/:provider/disconnect` - Disconnect calendar
- `POST /api/calendar/:provider/resync` - Manual resync

### Availability and Events

- `POST /api/calendar/freebusy` - Get free/busy availability
- `GET /api/calendar/external-events` - Fetch external calendar events

## Support

For issues or questions:
1. Check the server logs for detailed error messages
2. Verify OAuth application configuration
3. Ensure all environment variables are set correctly
4. Test with a single provider before enabling both

## Production Deployment

For production deployment:

1. Update redirect URIs to use HTTPS and your production domain
2. Use environment-specific configuration
3. Set up proper error monitoring
4. Configure rate limiting for calendar API calls
5. Consider using a secrets manager for sensitive credentials
6. Enable webhook subscriptions for real-time sync (optional enhancement)
