import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface ConnectButtonProps {
  onConnect: () => void;
  loading: boolean;
  disabled: boolean;
}

function ConnectButton({ onConnect, loading, disabled }: ConnectButtonProps) {
  return (
    <Button onClick={onConnect} disabled={disabled || loading}>
      {loading ? (
        <>
          <Loader2 className="animate-spin" />
          Connecting...
        </>
      ) : (
        'Connect to Google Sheets'
      )}
    </Button>
  );
}

export { ConnectButton };
