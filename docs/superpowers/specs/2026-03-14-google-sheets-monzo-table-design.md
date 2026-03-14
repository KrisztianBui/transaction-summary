# Design Spec: Google Sheets Monzo Transaction Table

**Date:** 2026-03-14
**Branch:** feature/google-sheets-monzo-table
**Status:** Agreed

---

## 1. Overview

A public-facing, frontend-only web app that allows any user to connect their own Monzo bank transaction Google Sheet and view the data in a formatted table. No backend is required. Authentication is performed entirely in the browser via Google Identity Services (GIS) OAuth 2.0 Token model, and sheet data is fetched directly from the Google Sheets API v4.

---

## 2. Architecture

### 2.1 Stack

| Layer         | Technology                              |
| ------------- | --------------------------------------- |
| Framework     | React 19 + TypeScript                   |
| Bundler       | Vite 7                                  |
| Styling       | Tailwind CSS v4 + shadcn/ui             |
| Auth          | Google Identity Services (GIS) – Token model (implicit flow) |
| Data          | Google Sheets API v4                    |
| State         | React component state (`useState`, `useReducer`) |
| No backend    | Entirely client-side; no server, no database |

### 2.2 Auth Flow

The app uses the **GIS Token model** (formerly the implicit flow). No authorization code or PKCE exchange is required. Steps:

1. User clicks "Connect Google Sheet".
2. The GIS `google.accounts.oauth2.initTokenClient` popup opens and the user grants the `https://www.googleapis.com/auth/spreadsheets.readonly` scope.
3. GIS returns an access token directly to the browser callback.
4. The access token is stored in component state (never persisted to localStorage or cookies).
5. Subsequent Sheets API v4 requests include the token in the `Authorization: Bearer <token>` header.
6. When the token expires (default 1 hour) the user must reconnect.

### 2.3 Data Flow

```
User pastes Sheet URL
        │
        ▼
SheetUrlInput (parses spreadsheet ID from URL)
        │
        ▼
ConnectButton (triggers GIS popup → receives access token)
        │
        ▼
useGoogleSheets hook
  ├── GET /v4/spreadsheets/{spreadsheetId}/values/{range}
  └── Maps raw 2D array → MonzoTransaction[]
        │
        ▼
TransactionTable (renders rows)
```

---

## 3. Google Sheet Format

The app targets a Google Sheet that Monzo generates when a user exports or syncs transactions. The sheet is expected to have a **header row** (row 1) followed by one transaction per row. The app reads a configurable range (default: `Sheet1!A:R`) to capture all 18 columns.

Column order (A–R):

| Col | Field                  |
| --- | ---------------------- |
| A   | Transaction ID         |
| B   | Date                   |
| C   | Time                   |
| D   | Type                   |
| E   | Name                   |
| F   | Emoji                  |
| G   | Category               |
| H   | Amount                 |
| I   | Currency               |
| J   | Local amount           |
| K   | Local currency         |
| L   | Notes and #tags        |
| M   | Address                |
| N   | Receipt                |
| O   | Description            |
| P   | Category split         |
| Q   | Money Out              |
| R   | Money In               |

---

## 4. Types

### 4.1 `MonzoTransaction`

```typescript
export interface MonzoTransaction {
  transactionId: string;      // A – unique Monzo transaction ID
  date: string;               // B – ISO date string, e.g. "2024-01-15"
  time: string;               // C – local time, e.g. "14:32:00"
  type: string;               // D – e.g. "card_payment", "faster_payment"
  name: string;               // E – merchant or payee name
  emoji: string;              // F – merchant emoji
  category: string;           // G – Monzo category, e.g. "eating_out"
  amount: string;             // H – signed amount in GBP, e.g. "-4.50"
  currency: string;           // I – ISO 4217 currency code, e.g. "GBP"
  localAmount: string;        // J – amount in local currency if foreign
  localCurrency: string;      // K – local currency code if foreign
  notes: string;              // L – free-text notes and hashtags
  address: string;            // M – merchant address
  receipt: string;            // N – receipt URL or identifier
  description: string;        // O – auto-generated description
  categorySplit: string;      // P – category split details
  moneyOut: string;           // Q – absolute debit amount, e.g. "4.50"
  moneyIn: string;            // R – absolute credit amount, e.g. "100.00"
}
```

### 4.2 GIS Token Client Types

The GIS library is loaded via a `<script>` tag and exposes `window.google`. A local ambient declaration file (`src/types/gis.d.ts`) provides TypeScript types:

```typescript
// src/types/gis.d.ts
interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string; message?: string }) => void;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrideConfig?: Partial<TokenClientConfig>): void;
}

interface Google {
  accounts: {
    oauth2: {
      initTokenClient(config: TokenClientConfig): TokenClient;
      revoke(token: string, callback?: () => void): void;
    };
  };
}

declare global {
  interface Window {
    google: Google;
  }
}
```

---

## 5. Components

### 5.1 `SheetUrlInput`

**File:** `src/components/SheetUrlInput.tsx`

**Purpose:** Accepts a Google Sheets URL from the user and extracts the spreadsheet ID.

**Props:**
```typescript
interface SheetUrlInputProps {
  value: string;
  onChange: (url: string) => void;
  error?: string;
}
```

**Behaviour:**
- Renders a labeled text input (shadcn `Input`) and an optional error message.
- The parent (`TransactionPage`) is responsible for parsing the spreadsheet ID from the URL and validating it.
- Placeholder: `https://docs.google.com/spreadsheets/d/…`

**URL parsing regex (used in parent):**
```typescript
const SHEET_ID_REGEX = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;
```

---

### 5.2 `ConnectButton`

**File:** `src/components/ConnectButton.tsx`

**Purpose:** Initiates GIS OAuth flow and surfaces connection state.

**Props:**
```typescript
interface ConnectButtonProps {
  isConnected: boolean;
  isLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}
```

**Behaviour:**
- When `isConnected` is `false`: renders a "Connect Google Sheet" button (primary variant).
- When `isConnected` is `true`: renders a "Disconnect" button (outline variant).
- When `isLoading` is `true`: button is disabled and shows a spinner icon.
- `onConnect` calls `tokenClient.requestAccessToken()` on the GIS token client.
- `onDisconnect` calls `google.accounts.oauth2.revoke(token)` and clears state.

---

### 5.3 `TransactionTable`

**File:** `src/components/TransactionTable.tsx`

**Purpose:** Renders the list of Monzo transactions in a scrollable table.

**Props:**
```typescript
interface TransactionTableProps {
  transactions: MonzoTransaction[];
  isLoading: boolean;
}
```

**Behaviour:**
- Uses a shadcn `Table` (wrapping `<table>`).
- Column visibility: `date`, `time`, `name`, `category`, `amount`, `currency`, `moneyOut`, `moneyIn`, `notes`.
  - All 18 fields are available in the type; only a human-readable subset is displayed by default.
- When `isLoading` is `true`: renders skeleton rows.
- When `transactions` is empty (and not loading): renders an empty-state message ("No transactions found").
- Amounts (`moneyOut`, `moneyIn`, `amount`) are right-aligned.
- Money Out cells are styled with a destructive/red text class; Money In with a success/green text class.

---

### 5.4 `TransactionPage`

**File:** `src/components/TransactionPage.tsx`

**Purpose:** Top-level page component that orchestrates state and child components.

**Internal state:**
```typescript
const [sheetUrl, setSheetUrl] = useState('');
const [urlError, setUrlError] = useState<string | undefined>();
const [accessToken, setAccessToken] = useState<string | null>(null);
const [tokenClient, setTokenClient] = useState<TokenClient | null>(null);
```

**Responsibilities:**
1. On mount: loads the GIS script (`https://accounts.google.com/gsi/client`) dynamically if not already present, then initialises `tokenClient` via `google.accounts.oauth2.initTokenClient`.
2. Validates the sheet URL on change: sets `urlError` if no spreadsheet ID can be parsed.
3. Passes `accessToken` and parsed `spreadsheetId` to the `useGoogleSheets` hook.
4. Renders `SheetUrlInput`, `ConnectButton`, any global error banner, and `TransactionTable`.

**Layout sketch:**
```
┌─────────────────────────────────────┐
│  Monzo Transaction Viewer           │
│                                     │
│  [Sheet URL input          ]        │
│  [Connect Google Sheet     ]        │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ Date | Name | Category | … │   │
│  ├──────────────────────────────┤   │
│  │ …                           │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## 6. Custom Hook: `useGoogleSheets`

**File:** `src/hooks/useGoogleSheets.ts`

**Signature:**
```typescript
function useGoogleSheets(params: {
  spreadsheetId: string | null;
  accessToken: string | null;
  range?: string; // defaults to "Sheet1!A:R"
}): {
  transactions: MonzoTransaction[];
  isLoading: boolean;
  error: string | null;
};
```

**Behaviour:**
- Does nothing if `spreadsheetId` or `accessToken` is `null`.
- Fetches from:
  ```
  https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}
  ```
  with header `Authorization: Bearer {accessToken}`.
- On success: maps the raw `values` 2D array (skipping row 0 as header) to `MonzoTransaction[]`.
- On failure: sets `error` with a human-readable message derived from the API error response.
- Re-fetches whenever `spreadsheetId` or `accessToken` changes.

**Row mapping (index → field):**
```typescript
const mapRow = (row: string[]): MonzoTransaction => ({
  transactionId: row[0] ?? '',
  date:          row[1] ?? '',
  time:          row[2] ?? '',
  type:          row[3] ?? '',
  name:          row[4] ?? '',
  emoji:         row[5] ?? '',
  category:      row[6] ?? '',
  amount:        row[7] ?? '',
  currency:      row[8] ?? '',
  localAmount:   row[9] ?? '',
  localCurrency: row[10] ?? '',
  notes:         row[11] ?? '',
  address:       row[12] ?? '',
  receipt:       row[13] ?? '',
  description:   row[14] ?? '',
  categorySplit: row[15] ?? '',
  moneyOut:      row[16] ?? '',
  moneyIn:       row[17] ?? '',
});
```

---

## 7. Error Handling

| Scenario               | Trigger                                   | User-Facing Message                                            |
| ---------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| Invalid sheet URL      | URL doesn't match spreadsheet ID regex    | "Please enter a valid Google Sheets URL."                     |
| OAuth popup blocked    | Browser blocks the GIS popup              | "The sign-in popup was blocked. Please allow popups and retry." |
| OAuth user denial      | User cancels or denies the GIS consent    | "Sign-in was cancelled."                                       |
| OAuth error response   | GIS returns `error` in `TokenResponse`    | "Authentication failed: {error_description}"                   |
| Sheets API 401         | Access token expired or invalid           | "Your session has expired. Please reconnect."                  |
| Sheets API 403         | Sheet is private / insufficient scope    | "Access denied. Make sure the sheet is shared with your Google account." |
| Sheets API 404         | Spreadsheet ID not found                  | "Spreadsheet not found. Check the URL and try again."          |
| Sheets API other error | Any other non-2xx response                | "Failed to load sheet data. Please try again."                 |
| Network failure        | `fetch` throws (offline, DNS, etc.)       | "Network error. Please check your connection."                 |

Errors are displayed in a dismissible alert banner above the table (shadcn `Alert` with `variant="destructive"`).

---

## 8. Environment & Configuration

### 8.1 Environment Variable

| Variable                | Required | Description                                      |
| ----------------------- | -------- | ------------------------------------------------ |
| `VITE_GOOGLE_CLIENT_ID` | Yes      | OAuth 2.0 Client ID from Google Cloud Console    |

Create a `.env.example` file at the project root:

```dotenv
# Google OAuth 2.0 Client ID
# Obtain from: https://console.cloud.google.com/apis/credentials
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

Copy to `.env.local` (gitignored) before running:
```bash
cp .env.example .env.local
```

### 8.2 Google Cloud Console Setup

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/) and create or select a project.
2. Navigate to **APIs & Services → Library** and enable **Google Sheets API**.
3. Navigate to **APIs & Services → Credentials** and click **Create Credentials → OAuth client ID**.
4. Choose **Web application**.
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5173` (Vite dev server)
   - Your production domain (e.g. `https://your-app.example.com`)
6. Leave **Authorized redirect URIs** empty (the Token model does not use a redirect URI).
7. Copy the **Client ID** value into `VITE_GOOGLE_CLIENT_ID` in your `.env.local`.
8. Navigate to **APIs & Services → OAuth consent screen**:
   - Set **User type** to **External**.
   - Fill in app name, support email, and developer contact.
   - Add scope: `https://www.googleapis.com/auth/spreadsheets.readonly`.
   - Add your own Google account as a **Test user** while the app is in Testing mode.

---

## 9. File Structure

```
src/
├── components/
│   ├── ui/                     # shadcn/ui primitives (Button, Input, Table, Alert, Skeleton)
│   ├── ConnectButton.tsx
│   ├── SheetUrlInput.tsx
│   ├── TransactionTable.tsx
│   └── TransactionPage.tsx
├── hooks/
│   └── useGoogleSheets.ts
├── types/
│   └── gis.d.ts
├── App.tsx                     # Renders <TransactionPage />
├── main.tsx
└── index.css
.env.example
```

---

## 10. Verification Steps

After implementation, verify the following:

1. **Dev server starts cleanly**
   ```bash
   pnpm dev
   ```
   No TypeScript errors, no console errors on page load.

2. **Invalid URL validation**
   - Paste a non-Sheets URL (e.g. `https://google.com`).
   - Confirm error message appears: "Please enter a valid Google Sheets URL."

3. **OAuth flow**
   - Paste a valid Sheets URL.
   - Click "Connect Google Sheet".
   - Confirm GIS popup opens.
   - Sign in and grant permission.
   - Confirm button changes to "Disconnect".

4. **Data loads**
   - After connecting, confirm the table populates with rows from the sheet.
   - Confirm the header row is excluded.
   - Confirm Money Out values appear in red, Money In in green.

5. **OAuth denial**
   - Repeat the flow but cancel the GIS popup.
   - Confirm the error banner shows "Sign-in was cancelled."

6. **Disconnect**
   - Click "Disconnect".
   - Confirm the table clears, the button reverts to "Connect Google Sheet", and the token is revoked.

7. **Token expiry (manual simulation)**
   - In browser DevTools, clear the access token from component state or wait 1 hour.
   - Confirm that a subsequent data fetch surfaces the "Your session has expired." error.

8. **Type check passes**
   ```bash
   pnpm typecheck
   ```

9. **Lint passes**
   ```bash
   pnpm lint
   ```

10. **Production build succeeds**
    ```bash
    pnpm build
    ```
