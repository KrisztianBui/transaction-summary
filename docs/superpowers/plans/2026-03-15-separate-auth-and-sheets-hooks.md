# Separate Auth and Sheets Hooks Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `useGoogleSheets.ts` into `useGoogleAuth.ts` (OAuth login/logout) and a rewritten `useGoogleSheets.ts` (reactive data fetching), then update `TransactionPage.tsx` to use both.

**Architecture:** `useGoogleAuth` manages the OAuth token in state. `useGoogleSheets(token, spreadsheetId)` uses a `useEffect` to fetch automatically when both are non-null, and resets when the token is cleared. `TransactionPage` coordinates both hooks and combines their `loading` and `error` states.

**Tech Stack:** React, TypeScript, `@react-oauth/google`, Google Sheets API v4, Vite + ESLint

**Spec:** `docs/superpowers/specs/2026-03-15-separate-auth-and-sheets-hooks-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/hooks/useGoogleAuth.ts` | **Create** | OAuth login/logout via `@react-oauth/google`; stores `token` in state |
| `src/hooks/useGoogleSheets.ts` | **Rewrite** | Fetches sheet data reactively when `token` + `spreadsheetId` are non-null |
| `src/components/TransactionPage.tsx` | **Modify** | Uses both hooks; combines `loading` and `error`; Disconnect shows when `token !== null` |

---

## Chunk 1: Create `useGoogleAuth`

### Task 1: Create `useGoogleAuth.ts`

**Files:**
- Create: `src/hooks/useGoogleAuth.ts`

- [ ] **Step 1: Create the file with the full implementation**

```typescript
import { useState } from 'react';

import { googleLogout, useGoogleLogin } from '@react-oauth/google';

export const useGoogleAuth = () => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useGoogleLogin({
    flow: 'implicit',
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    onSuccess: (tokenResponse) => {
      setToken(tokenResponse.access_token);
      setLoading(false);
    },
    onNonOAuthError: (err) => {
      if (err.type === 'popup_failed_to_open') {
        setError('Popup blocked. Please allow popups for this site and try again.');
      }
      // setLoading(false) is unconditional — covers both popup_failed_to_open
      // and popup_closed (user dismisses the OAuth popup without authenticating)
      setLoading(false);
    },
    onError: (err) => {
      setError(err.error_description ?? err.error ?? 'Authentication failed');
      setLoading(false);
    },
  });

  const signIn = (): void => {
    setLoading(true);
    setError(null);
    login();
  };

  const signOut = (): void => {
    googleLogout();
    setToken(null);
    setError(null);
    setLoading(false);
  };

  return { token, signIn, signOut, loading, error };
};
```

- [ ] **Step 2: Verify it type-checks**

```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGoogleAuth.ts
git commit -m "feat: add useGoogleAuth hook for OAuth login/logout"
```

---

## Chunk 2: Rewrite `useGoogleSheets`

### Task 2: Rewrite `useGoogleSheets.ts` as a pure data-fetching hook

**Files:**
- Modify: `src/hooks/useGoogleSheets.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
import { useEffect, useState } from 'react';

import type { MonzoTransaction } from '@/types/monzo';

interface SheetsApiResponse {
  values?: string[][];
}

interface SpreadsheetMetadata {
  sheets: { properties: { title: string } }[];
}

const rowToTransaction = (row: string[]): MonzoTransaction => ({
  transactionId: row[0] ?? '',
  date: row[1] ?? '',
  time: row[2] ?? '',
  type: row[3] ?? '',
  name: row[4] ?? '',
  emoji: row[5] ?? '',
  category: row[6] ?? '',
  amount: row[7] ?? '',
  currency: row[8] ?? '',
  localAmount: row[9] ?? '',
  localCurrency: row[10] ?? '',
  notes: row[11] ?? '',
  address: row[12] ?? '',
  receipt: row[13] ?? '',
  description: row[14] ?? '',
  categorySplit: row[15] ?? '',
  moneyOut: row[16] ?? '',
  moneyIn: row[17] ?? '',
});

export const useGoogleSheets = (
  token: string | null,
  spreadsheetId: string | null
) => {
  const [data, setData] = useState<MonzoTransaction[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Defensive: if spreadsheetId is cleared while token is held, reset state
    // so no stale data or error persists (e.g. user clears the URL input)
    if (!spreadsheetId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const fetchSheet = async (): Promise<void> => {
      setData(null);
      setLoading(true);
      setError(null);

      const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
      const headers = { Authorization: `Bearer ${token}` };

      try {
        const metaResponse = await fetch(
          `${baseUrl}?fields=sheets.properties.title`,
          { headers, signal }
        );

        if (metaResponse.status === 401) {
          setError('Session expired. Please reconnect.');
          setLoading(false);
          return;
        }

        if (!metaResponse.ok) {
          setError(`Failed to fetch sheet: ${metaResponse.status} ${metaResponse.statusText}`);
          setLoading(false);
          return;
        }

        const meta = (await metaResponse.json()) as SpreadsheetMetadata;
        const sheetName =
          meta.sheets[meta.sheets.length - 1]?.properties.title ?? 'Sheet1';

        const valuesResponse = await fetch(
          `${baseUrl}/values/${encodeURIComponent(sheetName)}`,
          { headers, signal }
        );

        if (valuesResponse.status === 401) {
          setError('Session expired. Please reconnect.');
          setLoading(false);
          return;
        }

        if (!valuesResponse.ok) {
          setError(
            `Failed to fetch sheet: ${valuesResponse.status} ${valuesResponse.statusText}`
          );
          setLoading(false);
          return;
        }

        const json = (await valuesResponse.json()) as SheetsApiResponse;
        const rows = json.values ?? [];
        setData(rows.slice(1).map(rowToTransaction));
        setLoading(false);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Unknown network error';
        setError(`Network error: ${message}`);
        setLoading(false);
      }
    };

    void fetchSheet();

    return () => {
      controller.abort();
    };
  }, [token, spreadsheetId]);

  return { data, loading, error };
};
```

- [ ] **Step 2: Verify it type-checks**

```bash
npm run typecheck
```

Expected: No errors. (TransactionPage will error until updated in Task 3 — that's fine.)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGoogleSheets.ts
git commit -m "refactor: rewrite useGoogleSheets as reactive data-fetching hook"
```

---

## Chunk 3: Update TransactionPage

### Task 3: Update `TransactionPage.tsx` to use both hooks

**Files:**
- Modify: `src/components/TransactionPage.tsx`

- [ ] **Step 1: Update the file**

```typescript
import { useState } from 'react';

import { ConnectButton } from '@/components/ConnectButton';
import { SheetUrlInput } from '@/components/SheetUrlInput';
import { TransactionTable } from '@/components/TransactionTable';
import { Button } from '@/components/ui/button';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';

export const TransactionPage = () => {
  const [sheetId, setSheetId] = useState<string | null>(null);
  const { token, signIn, signOut, loading: authLoading, error: authError } = useGoogleAuth();
  const { data, loading: sheetsLoading, error: sheetsError } = useGoogleSheets(token, sheetId);

  const error = authError ?? sheetsError;

  return (
    <main className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Monzo Transactions</h1>
      <SheetUrlInput onIdChange={setSheetId} />
      <ConnectButton
        onConnect={signIn}
        loading={authLoading || sheetsLoading}
        disabled={sheetId === null}
      />
      {token !== null && (
        <Button variant="outline" onClick={signOut}>
          Disconnect
        </Button>
      )}
      {error !== null && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
      {data !== null && <TransactionTable transactions={data} />}
    </main>
  );
};
```

- [ ] **Step 2: Type-check and lint**

```bash
npm run typecheck && npm run lint
```

Expected: No errors or warnings.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/TransactionPage.tsx
git commit -m "refactor: update TransactionPage to use useGoogleAuth and useGoogleSheets separately"
```

---

## End-to-End Verification

After all tasks are complete, manually verify in the browser (`npm run dev`):

1. Enter a valid Google Sheets URL → click Connect → authenticate → table populates
2. Click Disconnect → table clears, Disconnect button disappears
3. Enter an invalid sheet ID → Connect → authenticate → error message appears (sheetsError, not authError)
4. Block popups in browser → click Connect → popup-blocked error appears (authError)
5. Open OAuth popup → close it without authenticating → loading spinner disappears (not stuck)
6. While authenticated, paste a different valid sheet URL → table refreshes without stale data flash
