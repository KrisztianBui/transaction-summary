import { useQuery } from '@tanstack/react-query';

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

const fetchSheetData = async (
  token: string,
  spreadsheetId: string,
  signal: AbortSignal
): Promise<MonzoTransaction[]> => {
  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
  const headers = { Authorization: `Bearer ${token}` };

  const metaResponse = await fetch(`${baseUrl}?fields=sheets.properties.title`, {
    headers,
    signal,
  });

  if (metaResponse.status === 401) throw new Error('Session expired. Please reconnect.');
  if (!metaResponse.ok)
    throw new Error(`Failed to fetch sheet: ${metaResponse.status} ${metaResponse.statusText}`);

  const meta = (await metaResponse.json()) as SpreadsheetMetadata;
  const sheetName = meta.sheets[meta.sheets.length - 1]?.properties.title ?? 'Sheet1';

  const valuesResponse = await fetch(`${baseUrl}/values/${encodeURIComponent(sheetName)}`, {
    headers,
    signal,
  });

  if (valuesResponse.status === 401) throw new Error('Session expired. Please reconnect.');
  if (!valuesResponse.ok)
    throw new Error(
      `Failed to fetch sheet: ${valuesResponse.status} ${valuesResponse.statusText}`
    );

  const json = (await valuesResponse.json()) as SheetsApiResponse;
  return (json.values ?? []).slice(1).map(rowToTransaction);
};

export const useGoogleSheets = (token: string | null, spreadsheetId: string | null) => {
  const { data, isFetching, error } = useQuery({
    queryKey: ['sheets', token, spreadsheetId],
    queryFn: ({ signal }) => fetchSheetData(token!, spreadsheetId!, signal),
    enabled: !!token && !!spreadsheetId,
    retry: false,
  });

  return {
    data: data ?? null,
    loading: isFetching,
    error: error?.message ?? null,
  };
};
