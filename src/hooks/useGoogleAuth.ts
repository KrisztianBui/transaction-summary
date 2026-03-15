import { useState } from 'react';

import { googleLogout, useGoogleLogin } from '@react-oauth/google';

export const useGoogleAuth = () => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useGoogleLogin({
    flow: 'implicit',
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    onSuccess: (tokenResponse) => {
      setToken(tokenResponse.access_token);
      setLoading(false);
    },
    onNonOAuthError: (err) => {
      if (err.type === 'popup_failed_to_open') {
        setError('Popup blocked. Please allow popups for this site and try again.');
      }
      // setLoading(false) is unconditional — covers both popup_failed_to_open
      // and popup_closed (user dismisses the OAuth popup without authenticating)
      setLoading(false);
    },
    onError: (err) => {
      setError(err.error_description ?? err.error ?? 'Authentication failed');
      setLoading(false);
    },
  });

  const signIn = (): void => {
    setLoading(true);
    setError(null);
    login();
  };

  const signOut = (): void => {
    googleLogout();
    setToken(null);
    setError(null);
    setLoading(false);
  };

  return { token, signIn, signOut, loading, error };
};
