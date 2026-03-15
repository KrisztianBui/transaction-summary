# Spending Trend Analyzer — Design Spec

**Date:** 2026-03-15
**Status:** Approved

---

## Overview

A personal finance dashboard built on top of the existing Monzo Google Sheets integration. The app reads transaction history from a Monzo export spreadsheet and visualises spending trends, category breakdowns, and budget progress. Designed for personal use but shareable with others.

---

## Architecture

**Stack:** Vite + React + TypeScript + shadcn/ui, dark theme, existing `ThemeProvider`.

**New dependencies:** `react-router-dom` v6, `recharts`.

**Two Google Sheets:**
1. **Transactions sheet** — existing Monzo export; tab discovery behaviour (fetch last tab) unchanged
2. **Budgets sheet** — tab name `Budgets` (hardcoded), header row `['Category','MonthlyLimit']`, one row per category, col A = category name, col B = numeric string limit

**localStorage keys:**
- `'transactions-sheet-url'` — full Google Sheets URL
- `'budgets-sheet-url'` — full Google Sheets URL

**`parseSpreadsheetId(url: string): string | null`** — extracts ID between `/d/` and next `/`. Returns `null` if pattern not found. Null treated same as missing URL everywhere. Lives in **`src/lib/sheets.ts`**; imported by `Layout`, `useGoogleSheets`, and `useBudgetSheet`.

---

## OAuth Scope

The single `useGoogleLogin` call (inside `AuthProvider`) requests scope:

```
https://www.googleapis.com/auth/spreadsheets
```

This replaces the existing `spreadsheets.readonly` scope. Read-write is required because `useBudgetSheet` performs PUT/clear operations on the budgets sheet.

---

## Provider Tree & File Structure

```
main.tsx:
  <GoogleOAuthProvider>        ← existing, unchanged, outermost
    <ThemeProvider>            ← existing
      <AuthProvider>           ← new: holds token, signIn, signOut
        <DataProvider>         ← new: holds both data hooks + summary
          <RouterProvider router={router} />   ← react-router-dom

router (defined in src/router.tsx):
  / → redirect to /overview
  /overview, /categories, /trends, /budgets, /transactions, /settings
  All routes render inside a shared Layout component (sidebar + <Outlet />)
```

`App.tsx` is deleted. Its content (currently `<TransactionPage>`) is replaced by the router + Layout. `TransactionPage` is deleted; its responsibilities are split across `/overview` (connect flow, now in Settings) and `/transactions`.

---

## AuthContext

```ts
interface AuthContextValue {
  token: string | null;
  signIn: () => void;
  signOut: () => void;
}
```

`useGoogleLogin` (scope: `spreadsheets`) is called **exclusively inside `AuthProvider`**. It is removed from `useGoogleSheets` as part of the rewrite. On success, token stored in context state. `signOut` calls `googleLogout()` and clears token.

---

## DataContext

`DataProvider` calls both hooks and `useTransactionSummary`, exposing results via context to all views and Settings. `DataProvider` renames each hook's `refetch` when exposing it: `useGoogleSheets().refetch` → `refetchTransactions`, `useBudgetSheet().refetch` → `refetchBudgets`.

```ts
interface DataContextValue {
  transactions: MonzoTransaction[] | null;
  transactionsLoading: boolean;
  transactionsError: string | null;
  refetchTransactions: () => Promise<void>;

  budgets: BudgetLimit[];
  budgetsLoading: boolean;
  budgetsError: string | null;
  saveBudgets: (budgets: BudgetLimit[]) => Promise<void>;
  refetchBudgets: () => Promise<void>;

  summary: TransactionSummary;   // useTransactionSummary(transactions)
}
```

---

## Hooks

### `useGoogleSheets` (rewritten — replaces existing implementation entirely)

Called inside `DataProvider`. Reads `localStorage['transactions-sheet-url']`, parses ID with `parseSpreadsheetId`, reads token from `AuthContext`.

**Auto-fetch on mount:** if both token and ID are non-null on mount, fetches immediately. If either is null on mount, waits. When token becomes non-null (e.g. after sign-in), auto-fetches if ID is also set.

**Fetch behaviour (unchanged logic):** fetches spreadsheet metadata to find the last sheet tab name, then fetches that tab's values and maps rows to `MonzoTransaction[]`.

**Export shape (replaces previous `{ signIn, signOut, data, loading, error }`):**
```ts
{ data: MonzoTransaction[] | null; loading: boolean; error: string | null; refetch: () => Promise<void> }
```

`refetch(): Promise<void>` — re-reads the URL from `localStorage`, re-uses the token from `AuthContext`, performs the fetch, and resolves when done. No-op (resolves immediately) if token or ID is null. Errors are stored in `error` state; `refetch` does not throw. Callers (Settings) do not need to handle the returned promise — errors surface in the relevant view.

### `useBudgetSheet`

Called inside `DataProvider`. Reads `localStorage['budgets-sheet-url']`, parses ID, reads token from `AuthContext`.

**Auto-fetch on mount:** same rule as `useGoogleSheets` — fetches if token and ID are both non-null on mount; re-fetches when token becomes available.

**Read:** `GET /v4/spreadsheets/{id}/values/Budgets` — skips header row, parses remaining rows into `BudgetLimit[]`.

**Write (`saveBudgets`): `Promise<void>` — errors stored in `error` state, does not throw.**
1. `POST https://sheets.googleapis.com/v4/spreadsheets/{id}/values/Budgets:clear` — no request body; clears all existing content from the tab
2. `PUT https://sheets.googleapis.com/v4/spreadsheets/{id}/values/Budgets%21A1?valueInputOption=RAW` with JSON body:
   ```json
   {
     "range": "Budgets!A1",
     "majorDimension": "ROWS",
     "values": [
       ["Category", "MonthlyLimit"],
       ["Eating Out", "300"],
       ...
     ]
   }
   ```
   The hook always prepends `["Category","MonthlyLimit"]` as row 0 before sending. Data rows are the `BudgetLimit[]` argument serialised as `[category, String(monthlyLimit)]`.

```ts
interface BudgetLimit {
  category: string;
  monthlyLimit: number;
}

// returns:
{ budgets: BudgetLimit[]; loading: boolean; error: string | null; saveBudgets: (b: BudgetLimit[]) => Promise<void>; refetch: () => Promise<void> }
```

`refetch()` no-op if token or ID is null.

### `useTransactionSummary`

Pure computation (no side effects). Called in `DataProvider` with the `MonzoTransaction[] | null` from `useGoogleSheets`. Returns `{ byMonth: [], allCategories: [] }` when input is null.

**Month key:**
```ts
const [day, month, year] = date.split('/');
const monthKey = `${year}-${month}`;  // "2026-03"
```

**`byMonth`:** sorted ascending by `month` string (lexicographic order works correctly for `YYYY-MM` keys).

**moneyOut / moneyIn:** `parseFloat`; `NaN` or empty string → `0`.

**`allCategories`:** distinct `category` values, sorted alphabetically.

```ts
interface MonthlySummary {
  month: string;
  totalOut: number;
  totalIn: number;
  byCategory: Record<string, number>;
}
interface TransactionSummary {
  byMonth: MonthlySummary[];   // ascending by month key
  allCategories: string[];     // alphabetical
}
```

---

## Date Conventions

| Context | Format |
|---|---|
| `MonzoTransaction.date` | `DD/MM/YYYY` |
| `dateRange` prop | `DD/MM/YYYY` |
| Native `<input type="date">` | `YYYY-MM-DD` |
| `byMonth` keys | `YYYY-MM` |

**Utilities — `src/lib/dates.ts`:**
- `isoToMonzo(iso: string): string` — `YYYY-MM-DD` → `DD/MM/YYYY`
- `monzoToIso(monzo: string): string` — `DD/MM/YYYY` → `YYYY-MM-DD`

---

## Loading & Empty States

- **Loading:** shadcn `Skeleton` in place of cards/charts
- **Error:** shadcn `Alert`
- **Empty (no transactions after load):** "No data" message
- **Transactions URL not set or ID null:** `Layout` renders a full-page configure prompt instead of the view content; sidebar and routing still work so user can reach `/settings`

---

## Views

### Layout (shared)

`src/components/Layout.tsx` — renders the sidebar + `<Outlet />`. All routes render inside it. Checks `localStorage['transactions-sheet-url']` and `parseSpreadsheetId`; if null, renders the configure prompt over `<Outlet />`.

### Sidebar

Nav links: Overview, Categories, Trends, Budgets, Transactions. Settings at bottom. Active route highlighted.

### Overview (`/overview`)

- **Month picker:** `useState<string>`, default = last `byMonth` entry's `month`; disabled while loading; "No data" if `byMonth` empty
- **4 KPI cards** scoped to selected month:
  - Total Spent: `totalOut`; % vs preceding `byMonth` entry ("—" if none; red = higher, green = lower)
  - Total In: `totalIn`; same
  - Top Category: `Object.entries(byCategory).sort(([,a],[,b])=>b-a)[0]`
  - Budget Status: among `budgets` where `category` appears in `byCategory`, count those where `byCategory[cat]??0 <= monthlyLimit` → `"X / Y on track"`
- **Bar chart:** top 5 `byCategory` entries for selected month, descending
- **Budget progress panel** (scoped to month picker): loop `budgets`, look up `byCategory[cat]??0`; green <80%, amber 80–100%, red >100%; join in component
- Budgets URL not set/null ID: empty state + "Configure in Settings" link
- Budgets fetch fail: `Alert`

### Categories (`/categories`)

- **Picker state:** `{ mode: 'month'|'range'; month: string; from: string; to: string }`
  - Default: `mode='month'`, `month` = current calendar month `YYYY-MM`
- Month mode: filter `transactions` where `monthKey(date) === month`
- Range mode: filter where `monzoToIso(date) >= from && monzoToIso(date) <= to` (inclusive); missing bound = unbounded. Inputs are `<input type="date">` (YYYY-MM-DD); stored as-is in state for ISO comparison
- **Bar chart:** `moneyOut` per category for filtered set, computed inline
- **Drill-down:** `useState<string|null>`; one category at a time; click same to collapse; resets on unmount; shows date/name/moneyOut list

### Trends (`/trends`)

- **Line chart** (Recharts `LineChart`): x = `byMonth[].month`, y = £
- **Mode toggle** `useState<'total'|'byCategory'>`:
  - `'total'`: single `<Line>` on `totalOut`
  - `'byCategory'`: one `<Line>` per `allCategories` entry; colours cycle `['#6366f1','#f59e0b','#22c55e','#ef4444','#3b82f6','#ec4899','#14b8a6','#f97316','#8b5cf6','#64748b']` by index; Recharts `<Legend>`
- Recharts `<Tooltip>`

### Budgets (`/budgets`)

- Rows from `allCategories` (alphabetical)
- Each row: category name | `<Input type="number">` pre-filled from `budgets.find(b=>b.category===cat)?.monthlyLimit ?? ''` | progress bar vs current calendar month spend
- Current month: `new Date()` → `YYYY-MM`; look up in `byMonth`; if absent, spend = 0 (bar renders empty)
- Join in component
- **Save:** collect rows where `isFinite(parseFloat(input))`; call `saveBudgets()`; omit empty rows
- URL not set/null ID: prompt to configure Settings
- `saveBudgets` fail: `Alert`

### Transactions (`/transactions`)

`TransactionTable` (existing component, modified to accept optional filter props; `TransactionPage` wrapper is deleted):

```ts
interface TransactionTableProps {
  transactions: MonzoTransaction[];
  searchQuery?: string           // substring on `name`, case-insensitive
  categoryFilter?: string        // exact `category` match; '' or undefined = all
  dateRange?: { from: string; to: string } | null  // DD/MM/YYYY; compare via monzoToIso
}
```

Filtering inside `TransactionTable` before rendering rows.

Above table: search `Input`, category `Select` (from `allCategories` + "All"), from/to `<input type="date">` converted via `isoToMonzo` before storing in `dateRange` state.

Filter state local to `/transactions` page component.

### Settings (`/settings`)

- Two URL `Input`s pre-populated from `localStorage`
- **Save:** write both keys to `localStorage`; call `refetchTransactions()` + `refetchBudgets()` from `DataContext`
- Sign-in / sign-out from `AuthContext`

---

## Error Handling

- Fetch errors → `Alert` in relevant view
- Transactions URL not set/null ID → full-page prompt in `Layout`
- Budgets URL not set/null ID → empty state with Settings link (not an error)
- Budgets fetch fail → `Alert` in Budgets page and Overview budget panel
- `saveBudgets` fail → `Alert` on Budgets page

---

## Out of Scope

- Backend / database
- Auth beyond Google OAuth
- Pagination
- Export features
- Mobile layout
