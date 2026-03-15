import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface ConnectButtonProps {
  onConnect: () => void;
  loading: boolean;
  disabled: boolean;
}

export const ConnectButton = ({ onConnect, loading, disabled }: ConnectButtonProps) => (
  <Button
    onClick={onConnect}
    disabled={disabled || loading}
    aria-busy={loading}
  >
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
