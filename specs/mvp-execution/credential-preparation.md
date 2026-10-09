# Google Integration Setup for FlowPilot MVP

To build the **Manual → Google Sheets → Filter → Gmail** workflow, FlowPilot only needs a single Google OAuth connection that can access both Google Sheets and Gmail on behalf of the user.

---

# 1. Google Cloud Project

Create a dedicated **Google Cloud Project** for FlowPilot.

Enable the following APIs:

- Google Sheets API
- Gmail API

These APIs allow FlowPilot to:

- Read spreadsheet data from Google Sheets
- Send emails through Gmail

---

# 2. OAuth Client

Create an **OAuth 2.0 Client ID** with the type:

```text
Web Application
```

Google will generate:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Configure the OAuth redirect URI:

```text
https://your-flowpilot.com/api/auth/google/callback
```

Google uses the Client ID and Client Secret to identify and authenticate your application.

---

# 3. OAuth Scopes

## Google Sheets

For reading spreadsheet data:

```text
https://www.googleapis.com/auth/spreadsheets.readonly
```

This scope grants read-only access to Google Sheets.

Google also provides more restrictive scopes such as:

```text
drive.file
```

when you want access limited to selected files only.

Google generally recommends requesting the narrowest permissions possible.

---

## Gmail

For sending emails:

```text
https://www.googleapis.com/auth/gmail.send
```

This scope allows FlowPilot to send emails on behalf of the authenticated user.

---

## Combined OAuth Request

For the MVP workflow, FlowPilot can request both scopes during a single OAuth consent flow:

```text
https://www.googleapis.com/auth/spreadsheets.readonly
https://www.googleapis.com/auth/gmail.send
```

---

# 4. User Connects Google Account

When a user clicks:

```text
Connect Google
```

FlowPilot redirects the user to Google's OAuth consent page.

After the user approves access:

1. Google redirects back to FlowPilot.
2. FlowPilot receives an authorization code.
3. Backend exchanges that code for tokens.

Returned credentials:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600
}
```

Because FlowPilot requests offline access, Google can also return a refresh token that can be used to obtain new access tokens after expiration.

---

# 5. Credential Storage

Store the credentials securely in an encrypted credential store.

Example:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_at": "2026-09-25T12:00:00Z",
  "scope": [
    "spreadsheets.readonly",
    "gmail.send"
  ]
}
```

Suggested persistence model:

```text
connector_credentials
        ↓
encrypted
{
    access_token,
    refresh_token,
    expires_at,
    scope
}
```

---

# 6. One Google Connection for Multiple Nodes

Because both Google Sheets and Gmail belong to the same Google account, FlowPilot can reuse a single OAuth connection.

```text
My Google Account
        │
        ├── Google Sheets
        │      └── spreadsheets.readonly
        │
        └── Gmail
               └── gmail.send
```

Users do **not** need to connect:

```text
Connect Google Sheets
Connect Gmail
```

separately.

Instead:

```text
Connect Google
       ↓
Request all required scopes
       ↓
Create one credential record
       ↓
Reuse across Google nodes
```

Both the Google Sheets node and Gmail node can reference the same connection.

---

# Example Architecture

```text
User
  │
  ▼
Connect Google
  │
  ▼
Google OAuth
  │
  ▼
FlowPilot Credential Store
  │
  ├── Google Sheets Node
  │
  └── Gmail Node
```

---

# MVP Requirements Summary

```text
Google Cloud
├── Project
├── Google Sheets API       ✓
├── Gmail API               ✓
│
└── OAuth 2.0 Client
    ├── Client ID
    ├── Client Secret
    └── Redirect URI
```

## Required OAuth Scopes

```text
spreadsheets.readonly
gmail.send
```

## Stored User Credentials

```text
access_token
refresh_token
expires_at
granted_scopes
```

---

# What You Do NOT Need for MVP

```text
✗ API Key
✗ Service Account
✗ Google Apps Script
```

For the workflow:

```text
Manual Trigger
      ↓
Google Sheets
      ↓
Filter
      ↓
Gmail
```

the application operates on data owned by the authenticated user.

Therefore:

- OAuth 2.0 is the appropriate authentication mechanism.
- Service Accounts are intended for application-owned or shared resources.
- API Keys do not work for user-specific Google data access.
- Google Apps Script is unnecessary for this MVP implementation.

---

# Final Recommendation

For FlowPilot MVP, implement a **single Google OAuth connector** that requests:

```text
spreadsheets.readonly
gmail.send
```

Store the resulting access and refresh tokens securely, then allow both the Google Sheets and Gmail nodes to reuse the same credential. This minimizes user friction, simplifies credential management, and scales naturally as additional Google integrations are added later.