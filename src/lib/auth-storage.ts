const AUTH_BASE_URL = 'https://auth.deriv.com/oauth2';

export interface AuthConfig {
  clientId: string;
  redirectUri: string;
  scopes?: string;
  affiliateToken?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface AuthInfo {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  scope: string;
  refresh_token?: string;
}

export interface CallbackParams {
  code: string | null;
  state: string | null;
  scope: string | null;
  error: string | null;
  error_description: string | null;
}

const STORAGE_KEYS = {
  csrfToken: 'deriv_csrf_token',
  codeVerifier: 'deriv_code_verifier',
  authInfo: 'deriv_auth_info',
} as const;

export function storeCSRFToken(token: string): void {
  sessionStorage.setItem(STORAGE_KEYS.csrfToken, token);
}

export function getCSRFToken(): string | null {
  return sessionStorage.getItem(STORAGE_KEYS.csrfToken);
}

export function clearCSRFToken(): void {
  sessionStorage.removeItem(STORAGE_KEYS.csrfToken);
}

export function storeCodeVerifier(verifier: string): void {
  sessionStorage.setItem(STORAGE_KEYS.codeVerifier, verifier);
}

export function getCodeVerifier(): string | null {
  return sessionStorage.getItem(STORAGE_KEYS.codeVerifier);
}

export function clearCodeVerifier(): void {
  sessionStorage.removeItem(STORAGE_KEYS.codeVerifier);
}

export function storeAuthInfo(authInfo: AuthInfo): void {
  localStorage.setItem(STORAGE_KEYS.authInfo, JSON.stringify(authInfo));
}

export function getStoredAuthInfo(): AuthInfo | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.authInfo);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function clearAuthInfo(): void {
  localStorage.removeItem(STORAGE_KEYS.authInfo);
}

export function clearAllAuthData(): void {
  clearCSRFToken();
  clearCodeVerifier();
  clearAuthInfo();
}
