interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string }) => void;
}

interface TokenResponse {
  access_token: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

interface TokenClient {
  requestAccessToken(overrideConfig?: Partial<TokenClientConfig>): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: TokenClientConfig): TokenClient;
          revoke(token: string, callback?: () => void): void;
        };
      };
    };
  }
}
