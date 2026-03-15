import { useRef, useState } from 'react';

import { googleLogout, useGoogleLogin } from '@react-oauth/google';

import type { MonzoTransaction } from '@/types/monzo';

interface SheetsApiResponse {
  values?: string[][];
}

interface SpreadsheetMetadata {
  sheets: { properties: { title: string } }[];
}

function rowToTransaction(row: string[]): MonzoTransaction {
  return {
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
  };
}

export function useGoogleSheets() {
  const [data, setData] = useState<MonzoTransaction[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingSpreadsheetIdRef = useRef<string | null>(null);

  async function fetchSheet(
    spreadsheetId: string,
    token: string
  ): Promise<void> {
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
    const headers = { Authorization: `Bearer ${token}` };

    try {
      // Fetch spreadsheet metadata to get the actual first sheet name
      const metaResponse = await fetch(`${baseUrl}?fields=sheets.properties.title`, { headers });
      if (!metaResponse.ok) {
        setError(`Failed to fetch sheet: ${metaResponse.status} ${metaResponse.statusText}`);
        return;
      }
      const meta = (await metaResponse.json()) as SpreadsheetMetadata;
      const sheetName = meta.sheets[meta.sheets.length - 1]?.properties.title ?? 'Sheet1';

      const valuesResponse = await fetch(
        `${baseUrl}/values/${encodeURIComponent(sheetName)}`,
        { headers }
      );

      if (!valuesResponse.ok) {
        setError(`Failed to fetch sheet: ${valuesResponse.status} ${valuesResponse.statusText}`);
        return;
      }

      const json = (await valuesResponse.json()) as SheetsApiResponse;
      const rows = json.values ?? [];
      // Skip row 0 (header row)
      const transactions = rows.slice(1).map(rowToTransaction);
      setData(transactions);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown network error';
      setError(`Network error: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  const login = useGoogleLogin({
    flow: 'implicit',
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    onSuccess: (tokenResponse) => {
      const spreadsheetId = pendingSpreadsheetIdRef.current;
      if (spreadsheetId) {
        void fetchSheet(spreadsheetId, tokenResponse.access_token);
      }
    },
    onError: (err) => {
      setError(err.error_description ?? err.error ?? 'Authentication failed');
      setLoading(false);
    },
  });

  function signIn(spreadsheetId: string): void {
    setLoading(true);
    setError(null);
    setData(null);
    pendingSpreadsheetIdRef.current = spreadsheetId;
    login();
  }

  function signOut(): void {
    googleLogout();
    setData(null);
    setError(null);
    setLoading(false);
  }

  return { signIn, signOut, data, loading, error };
}
