const CSRF_TOKEN_KEY = 'oauth_csrf_token';
const CODE_VERIFIER_KEY = 'oauth_code_verifier';
const AUTH_INFO_KEY = 'auth_info';
const TOKEN_MAX_AGE_MS = 10 * 60 * 1000;

export interface AuthInfo {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  scope: string;
  refresh_token: string;
}

interface StoredTimestamped {
  value: string;
  createdAt: number;
}

export function storeCSRFToken(token: string): void {
  const stored: StoredTimestamped = { value: token, createdAt: Date.now() };
  sessionStorage.setItem(CSRF_TOKEN_KEY, JSON.stringify(stored));
}

export function getCSRFToken(): string | null {
  const raw = sessionStorage.getItem(CSRF_TOKEN_KEY);
  if (!raw) return null;
  const stored: StoredTimestamped = JSON.parse(raw);
  if (Date.now() - stored.createdAt > TOKEN_MAX_AGE_MS) {
    clearCSRFToken();
    return null;
  }
  return stored.value;
}

export function clearCSRFToken(): void {
  sessionStorage.removeItem(CSRF_TOKEN_KEY);
}

export function storeCodeVerifier(verifier: string): void {
  const stored: StoredTimestamped = { value: verifier, createdAt: Date.now() };
  sessionStorage.setItem(CODE_VERIFIER_KEY, JSON.stringify(stored));
}

export function getCodeVerifier(): string | null {
  const raw = sessionStorage.getItem(CODE_VERIFIER_KEY);
  if (!raw) return null;
  const stored: StoredTimestamped = JSON.parse(raw);
  if (Date.now() - stored.createdAt > TOKEN_MAX_AGE_MS) {
    clearCodeVerifier();
    return null;
  }
  return stored.value;
}

export function clearCodeVerifier(): void {
  sessionStorage.removeItem(CODE_VERIFIER_KEY);
}

export function storeAuthInfo(authInfo: AuthInfo): void {
  localStorage.setItem(AUTH_INFO_KEY, JSON.stringify(authInfo));
}

export function getAuthInfo(): AuthInfo | null {
  const raw = localStorage.getItem(AUTH_INFO_KEY);
  if (!raw) return null;
  const authInfo: AuthInfo = JSON.parse(raw);
  if (authInfo.expires_at && Date.now() > authInfo.expires_at * 1000) {
    return null;
  }
  return authInfo;
}

export function clearAuthInfo(): void {
  localStorage.removeItem(AUTH_INFO_KEY);
}

export function clearAllAuthData(): void {
  clearCSRFToken();
  clearCodeVerifier();
  clearAuthInfo();
}
