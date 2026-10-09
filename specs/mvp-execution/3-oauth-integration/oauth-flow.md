# Google OAuth Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Workflow Designer (Main Window)
    participant Popup as OAuth Popup Window
    participant API as FlowPilot Backend
    participant Google as Google OAuth Server
    participant DB as Database (Prisma)

    User->>UI: Click "Connect google-credential" button
    UI->>API: GET /api/integrations/google/auth
    Note right of UI: Request includes JWT Auth Header
    API->>API: Generate OAuth URL & encode userId in `state`
    API-->>UI: Return JSON { url }
    UI->>Popup: window.open(url, 'OAuth')
    Popup->>Google: Navigate to Google Consent Screen
    User->>Google: Authenticate & Authorize Scopes (Sheets, Gmail)
    
    Google-->>API: Redirect to /api/integrations/google/callback?code=...&state=...
    Note right of Google: Redirect hits backend directly
    API->>API: Extract authorization `code` & decode `userId` from `state`
    API->>Google: Exchange `code` for tokens
    Google-->>API: Return access & refresh tokens
    API->>API: Encrypt tokens with AES-256-GCM (EncryptionUtil)
    API->>DB: INSERT into `connector_credentials`
    Note right of API: Binds credential to `ownerId` (userId)
    DB-->>API: Persisted
    
    API-->>Popup: Return HTML with <script>
    Popup->>UI: window.opener.postMessage('oauth-success', '*')
    Popup->>Popup: window.close()
    
    UI->>UI: Listen for 'oauth-success' event
    UI->>UI: Update Node's localConfig (mark as connected)
    Note left of UI: MVP behavior: simply updates the credential field
    User->>UI: User continues working & publishes workflow
    UI->>API: Save/Publish workflow data
```

## Contract Resolution

This documented diagram reflects the **exact backend and frontend implementation**:
- **Security:** The OAuth tokens are never transmitted to the frontend. The backend creates the `connector_credentials` database record immediately during the Google callback.
- **Inter-Window Communication:** The callback endpoint returns an HTML script that uses `window.opener.postMessage` to securely notify the main UI window without passing sensitive payload data.
- **Frontend State:** Upon receiving the `oauth-success` message, the frontend implicitly maps the success to the node configuration.
