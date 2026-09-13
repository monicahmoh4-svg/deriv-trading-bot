function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join('');
}

function base64urlencode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64urlencode(digest);
}

export function generateCodeVerifier(): string {
  return generateRandomString(64);
}

export function generateState(): string {
  return generateRandomString(32);
}

export interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}

export async function generatePKCEParams(): Promise<PKCEParams> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();
  return { codeVerifier, codeChallenge, state };
}

export function buildAuthUrl(
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  state: string,
  scope: string = 'trade account_manage read'
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://auth.deriv.com/oauth2/auth?${params.toString()}`;
}

export function storePKCEParams(params: PKCEParams): void {
  sessionStorage.setItem('pkce_code_verifier', params.codeVerifier);
  sessionStorage.setItem('pkce_state', params.state);
}

export function getStoredCodeVerifier(): string | null {
  return sessionStorage.getItem('pkce_code_verifier');
}

export function getStoredState(): string | null {
  return sessionStorage.getItem('pkce_state');
}

export function clearPKCEParams(): void {
  sessionStorage.removeItem('pkce_code_verifier');
  sessionStorage.removeItem('pkce_state');
}
