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
