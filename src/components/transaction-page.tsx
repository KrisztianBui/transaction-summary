import { useState } from 'react';

import { ConnectButton } from '@/components/connect-button';
import { SheetUrlInput } from '@/components/sheet-url-input';
import { TransactionTable } from '@/components/transaction-table';
import { useGoogleSheets } from '@/hooks/use-google-sheets';

function TransactionPage() {
  const [sheetId, setSheetId] = useState<string | null>(null);
  const { signIn, data, loading, error } = useGoogleSheets();

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Monzo Transactions</h1>
      <SheetUrlInput onIdChange={setSheetId} />
      <ConnectButton
        onConnect={() => {
          if (sheetId) signIn(sheetId);
        }}
        loading={loading}
        disabled={sheetId === null}
      />
      {error !== null && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
      {data !== null && <TransactionTable transactions={data} />}
    </div>
  );
}

export { TransactionPage };
