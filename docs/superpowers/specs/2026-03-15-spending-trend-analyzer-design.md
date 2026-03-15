# Spending Trend Analyzer — Design Spec

**Date:** 2026-03-15
**Status:** Approved

---

## Overview

A personal finance dashboard built on top of the existing Monzo Google Sheets integration. The app reads transaction history from a Monzo export spreadsheet and visualises spending trends, category breakdowns, and budget progress. Designed for personal use but shareable with others.

---

## Architecture

**Stack:** Existing Vite + React + TypeScript + shadcn/ui, dark theme via the existing `ThemeProvider`.

**New dependencies:**
- `react-router-dom` v6 — client-side routing for sidebar navigation
- `recharts` — chart library (shadcn-recommended)

**Two Google Sheets data sources:**
1. **Transactions sheet** — existing Monzo export (already integrated via `useGoogleSheets`)
2. **Budgets sheet** — a user-managed sheet with one row per category: `category, monthlyLimit`

**Sheet URLs** are stored in `localStorage` (entered once via Settings) so users don't re-enter them on every visit.

**New hooks:**
- `useBudgetSheet` — reads and writes the budgets Google Sheet, reusing the same Google OAuth token
- `useTransactionSummary` — pure computation hook that aggregates `MonzoTransaction[]` into per-category and per-month summaries for use in charts

---

## Routing

```
/             → redirect to /overview
/overview
/categories
/trends
/budgets
/transactions
/settings
```

A persistent sidebar renders on all routes with navigation links and a Settings link at the bottom.

---

## Views

### Sidebar (persistent)

- App name / logo at top
- Navigation links: Overview, Categories, Trends, Budgets, Transactions
- Settings link at bottom
- Active link highlighted with indigo accent (shadcn `Button` variant)

### Overview (`/overview`)

- **Month picker** dropdown (top-right) — defaults to current month
- **4 KPI cards** (shadcn `Card`):
  - Total Spent — with % change vs previous month (red if higher, green if lower)
  - Total In — with % change vs previous month
  - Top Category — name + amount
  - Budget Status — `X / Y on track`, with count of over-budget categories
- **Category bar chart** (Recharts `BarChart`) — top 5 categories by spend for selected month
- **Budget progress panel** — per-category progress bars, colour-coded:
  - Green: < 80% of limit
  - Amber: 80–100%
  - Red: over limit

### Categories (`/categories`)

- **Month/range picker** — toggle between current month and a custom date range
- **Bar chart** — spend per category for selected period
- **Drill-down** — clicking a category expands a transaction list beneath the chart filtered to that category

### Trends (`/trends`)

- **Line chart** (Recharts `LineChart`) — total monthly spend over all months present in the sheet
- **Category toggle** — switch to show each category as its own line
- **Hover tooltips** — exact amounts on hover

### Budgets (`/budgets`)

- List of all Monzo categories, each row showing:
  - Category name
  - Monthly limit input (shadcn `Input`)
  - Current month spend vs limit (progress bar)
- **Save budgets** button — writes all limits back to the budgets Google Sheet
- Limits are loaded from the budgets sheet on mount

### Transactions (`/transactions`)

- Existing `TransactionTable` component, relocated from the current main page
- **Search** by merchant name (shadcn `Input`)
- **Filter** by category (shadcn `Select`) and date range (two date inputs)

### Settings (`/settings`)

- Two URL inputs:
  - Transactions sheet URL (pre-populated from localStorage if set)
  - Budgets sheet URL (pre-populated from localStorage if set)
- Saving updates localStorage and triggers a re-fetch of both sheets
- Google sign-in / sign-out control (currently on the main page — moved here)

---

## Data Flow

```
Settings → localStorage → sheet URLs
                                    ↓
OAuth login → useGoogleSheets (transactions) + useBudgetSheet (budgets)
                                    ↓
useTransactionSummary ← transactions data
         ↓
Overview, Categories, Trends views

Budget limits (useBudgetSheet) → Budgets view + Budget progress panel (Overview)
```

---

## Error Handling

- Sheet fetch errors shown via shadcn `Alert` (already partially implemented)
- If budgets sheet URL is not set, Budgets page shows a prompt to configure it in Settings
- If a category in the transactions sheet has no corresponding budget, it renders without a progress bar (no limit set)

---

## Out of Scope

- Backend / database — all data stays in Google Sheets
- Authentication beyond Google OAuth (already implemented)
- Pagination of the transactions table
- Export / download features
- Mobile-specific layout (responsive is nice-to-have, not required)
