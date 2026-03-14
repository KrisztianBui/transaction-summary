import { useEffect, useRef, useState } from 'react'

import type { MonzoTransaction } from '@/types/monzo'

interface SheetsApiResponse {
  values?: string[][]
}

interface Oauth2Api {
  initTokenClient: (config: TokenClientConfig) => TokenClient
}

function getOauth2(): Oauth2Api | undefined {
  // window.google is typed via ambient gis.d.ts but ESLint's TS plugin cannot resolve
  // the declaration-merged Window augmentation — cast through unknown to avoid unsafe-member errors.
  const g = (window as unknown as { google?: { accounts?: { oauth2?: Oauth2Api } } }).google
  return g?.accounts?.oauth2
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
  }
}

export function useGoogleSheets() {
  const [data, setData] = useState<MonzoTransaction[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tokenClientRef = useRef<TokenClient | null>(null)
  const pendingSpreadsheetIdRef = useRef<string | null>(null)
  const scriptLoadingRef = useRef(false)

  async function fetchSheet(spreadsheetId: string, token: string): Promise<void> {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/Sheet1`
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        setError(`Failed to fetch sheet: ${response.status} ${response.statusText}`)
        setLoading(false)
        return
      }

      const json = (await response.json()) as SheetsApiResponse
      const rows = json.values ?? []
      // Skip row 0 (header row)
      const transactions = rows.slice(1).map(rowToTransaction)
      setData(transactions)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown network error'
      setError(`Network error: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  function handleTokenResponse(response: TokenResponse): void {
    if (response.error) {
      setError(response.error_description ?? response.error)
      setLoading(false)
      return
    }
    const spreadsheetId = pendingSpreadsheetIdRef.current
    if (spreadsheetId) {
      void fetchSheet(spreadsheetId, response.access_token)
    }
  }

  function initTokenClient(): void {
    const oauth2 = getOauth2()
    if (!oauth2) return
    tokenClientRef.current = oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      callback: handleTokenResponse,
    })
  }

  useEffect(() => {
    if (scriptLoadingRef.current) return

    const existingScript = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]',
    )

    if (existingScript) {
      // Script already present — initialise token client immediately if GIS is ready
      initTokenClient()
      return
    }

    scriptLoadingRef.current = true
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => {
      initTokenClient()
    }
    document.head.appendChild(script)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function signIn(spreadsheetId: string): void {
    setLoading(true)
    setError(null)
    pendingSpreadsheetIdRef.current = spreadsheetId
    tokenClientRef.current?.requestAccessToken()
  }

  return { signIn, data, loading, error }
}
