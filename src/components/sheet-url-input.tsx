import * as React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SheetUrlInputProps {
  onIdChange: (id: string | null) => void;
}

const SPREADSHEET_ID_REGEX = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

function SheetUrlInput({ onIdChange }: SheetUrlInputProps) {
  const [value, setValue] = React.useState('');
  const [extractedId, setExtractedId] = React.useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target.value;
    setValue(input);

    if (input === '') {
      setExtractedId(null);
      onIdChange(null);
      return;
    }

    const match = SPREADSHEET_ID_REGEX.exec(input);
    if (match) {
      const id = match[1];
      setExtractedId(id);
      onIdChange(id);
    } else {
      setExtractedId(null);
      onIdChange(null);
    }
  }

  const showError = value !== '' && extractedId === null;
  const showSuccess = extractedId !== null;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="sheet-url-input">Google Sheets URL</Label>
      <Input
        id="sheet-url-input"
        type="url"
        value={value}
        onChange={handleChange}
        placeholder="https://docs.google.com/spreadsheets/d/..."
      />
      {showError && <p className="text-sm text-red-500">Invalid Google Sheets URL</p>}
      {showSuccess && (
        <p className="text-sm text-green-600">
          Sheet ID: {extractedId}
        </p>
      )}
    </div>
  );
}

export { SheetUrlInput };
