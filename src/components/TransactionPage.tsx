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
