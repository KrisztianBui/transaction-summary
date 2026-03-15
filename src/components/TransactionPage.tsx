import { useState } from 'react';

import { ConnectButton } from '@/components/ConnectButton';
import { SheetUrlInput } from '@/components/SheetUrlInput';
import { TransactionTable } from '@/components/TransactionTable';
import { Button } from '@/components/ui/button';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';

function TransactionPage() {
  const [sheetId, setSheetId] = useState<string | null>(null);
  const { signIn, signOut, data, loading, error } = useGoogleSheets();

  return (
    <main className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Monzo Transactions</h1>
      <SheetUrlInput onIdChange={setSheetId} />
      <ConnectButton
        onConnect={() => {
          if (sheetId) signIn(sheetId);
        }}
        loading={loading}
        disabled={sheetId === null}
      />
      {data !== null && (
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
}

export { TransactionPage };
