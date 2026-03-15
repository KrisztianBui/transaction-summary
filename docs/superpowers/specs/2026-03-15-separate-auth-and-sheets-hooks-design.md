# Design: Separate Google Auth and Google Sheets Hooks

**Date:** 2026-03-15
**Status:** Approved

## Context

`useGoogleSheets.ts` currently bundles two distinct concerns: Google OAuth login/logout (via `@react-oauth/google`) and Google Sheets API data fetching. Separating them improves testability and single-responsibility, and removes a `pendingSpreadsheetIdRef` workaround that was only needed to bridge the two concerns.

## Approach: Reactive split

`useGoogleAuth` stores the OAuth access token in state. `useGoogleSheets(token, spreadsheetId)` uses a `useEffect` to automatically fetch when both are non-null, and resets when the token is cleared. No imperative coordination is needed.

## Files

| File | Change |
|------|--------|
| `src/hooks/useGoogleAuth.ts` | **New** — OAuth login/logout, `token` state |
| `src/hooks/useGoogleSheets.ts` | **Rewrite** — data fetching only, reactive to `(token, spreadsheetId)` |
| `src/components/TransactionPage.tsx` | **Update** — use both hooks, combine loading/error, update Disconnect visibility |

Both hooks must use arrow function exports per code conventions (`export const useX = () => {}`).

## Hook APIs

### `useGoogleAuth`

```typescript
export const useGoogleAuth = () => {
  return { token, signIn, signOut, loading, error };
};
```

**State lifecycle:**
- `signIn()`: sets `loading=true`, clears `error`, triggers OAuth popup
- `onSuccess`: stores token in state, sets `loading=false`
- `onError` / `onNonOAuthError`: sets error message, sets `loading=false`
- `signOut()`: calls `googleLogout()`, clears `token`, `error`, and `loading`

### `useGoogleSheets`

```typescript
export const useGoogleSheets = (
  token: string | null,
  spreadsheetId: string | null
) => {
  return { data, loading, error };
};
```

**`useEffect` on `[token, spreadsheetId]`:**
- If `!token`: reset `data=null`, `error=null`, `loading=false` (safe no-op on initial render when already null)
- If `token && spreadsheetId`:
  1. Immediately set `data=null`, `loading=true`, `error=null` (clears stale data before fetch)
  2. Create `AbortController`; pass signal to both `fetch` calls
  3. Fetch sheet metadata, then fetch values
  4. On success: set `data`, `loading=false`
  5. On non-200: set `error` message, `loading=false`
  6. On `AbortError`: do nothing (effect re-fired with new values)
  7. On network error: set `error` message, `loading=false`
  8. On 401 response: set `error="Session expired. Please reconnect."`, `loading=false`
- Effect cleanup: call `abort()` on the controller (cancels in-flight requests when `token` or `spreadsheetId` changes)

**Token expiry:** The implicit OAuth flow issues short-lived tokens (~1 hour). When the Sheets API returns 401, `useGoogleSheets` surfaces it as a `sheetsError`. The user must click Disconnect and reconnect to re-authenticate. No automatic refresh is implemented.

### `TransactionPage` usage

```typescript
const { token, signIn, signOut, loading: authLoading, error: authError } = useGoogleAuth();
const { data, loading: sheetsLoading, error: sheetsError } = useGoogleSheets(token, sheetId);

// signIn takes no args — spreadsheetId is tracked separately in component state
// combined loading: authLoading || sheetsLoading
// combined error: authError ?? sheetsError
// Disconnect button visibility: token !== null (not data !== null)
```

**Disconnect button change:** Previously shown when `data !== null`. After this change, shown when `token !== null` — this allows disconnecting while a fetch is in progress or after a fetch error.

## Data Flow

```
User clicks Connect:
  1. signIn() → authLoading=true, OAuth popup opens
  2. onSuccess → token stored in state, authLoading=false
  3. useGoogleSheets useEffect fires (token + sheetId non-null)
  4. data=null, sheetsLoading=true
  5. Fetches sheet metadata → fetches values → sets data, sheetsLoading=false

User changes sheet URL while authenticated:
  1. spreadsheetId changes → useEffect cleanup aborts in-flight fetch
  2. New effect run: data=null, sheetsLoading=true, fetches new sheet

User clicks Disconnect:
  1. signOut() → googleLogout(), token=null
  2. useGoogleSheets useEffect fires (token=null) → data=null, error=null

Token expires mid-session:
  1. Sheets API returns 401
  2. sheetsError = "Session expired. Please reconnect."
  3. User clicks Disconnect, then Connect to re-authenticate
```

## Key changes summary

- `pendingSpreadsheetIdRef` removed — the reactive pattern replaces it
- `signIn()` takes no arguments
- `rowToTransaction`, `SheetsApiResponse`, `SpreadsheetMetadata` stay in `useGoogleSheets.ts`
- `AbortController` added to handle rapid spreadsheetId changes
- Disconnect button condition changes from `data !== null` to `token !== null`
- Both hooks use arrow function exports per code conventions

## Verification

1. `npm run build` — no TypeScript errors
2. Enter valid Google Sheets URL → click Connect → authenticate → verify table populates
3. Click Disconnect → verify table clears and Disconnect button disappears
4. Enter invalid sheet ID → Connect → authenticate → verify `sheetsError` message appears, `authError` is null (error is from the sheets fetch, not auth)
5. Block popups in browser → click Connect → verify popup-blocked `authError` appears
6. While authenticated, paste a different valid sheet URL → verify table refreshes with new data (no stale data flash)
7. `npm run lint` — no ESLint errors
