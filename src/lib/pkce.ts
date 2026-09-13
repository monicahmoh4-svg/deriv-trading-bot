function generateRandomBase64url(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64urlencode(bytes.buffer);
}

function base64urlencode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Base64url(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64urlencode(digest);
}

export function generateCSRFToken(): string {
  return generateRandomBase64url(32);
}

export function generateCodeVerifier(): string {
  return generateRandomBase64url(32);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  return sha256Base64url(verifier);
}
