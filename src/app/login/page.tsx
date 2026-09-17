'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { getDerivAppId, DERIV_REDIRECT_URI, getDerivWebSocket } from '@/lib/deriv-websocket';

function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function base64urlencode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hashed = await sha256(verifier);
  return base64urlencode(hashed);
}

export default function LoginPage() {
  const router = useRouter();
  const { auth, setAuth, setBalance } = useStore();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [appId, setAppId] = useState('');

  useEffect(() => {
    if (auth.token) {
      router.replace('/dashboard');
    }
  }, [auth.token, router]);

  useEffect(() => {
    setAppId(getDerivAppId());
  }, []);

  const handleOAuthLogin = async (isDemo: boolean) => {
    const id = getDerivAppId();
    if (!id) {
      setError('App ID not configured');
      return;
    }

    try {
      const state = generateRandomString(32);
      const codeVerifier = generateRandomString(64);
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      sessionStorage.setItem('deriv_oauth_state', state);
      sessionStorage.setItem('deriv_code_verifier', codeVerifier);

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: id,
        redirect_uri: DERIV_REDIRECT_URI,
        scope: 'read',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      if (isDemo) {
        params.set('account_type', 'virtual');
      }

      window.location.href = `https://auth.deriv.com/oauth2/auth?${params.toString()}`;
    } catch {
      setError('Failed to initialize login');
    }
  };

  const handleTokenLogin = async () => {
    if (!token.trim()) {
      setError('Please enter a token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const ws = getDerivWebSocket();
      await ws.connect();

      let authResponse: Record<string, unknown>;
      try {
        authResponse = (await ws.authenticate(token.trim())) as Record<string, unknown>;
      } catch {
        throw new Error('Failed to authenticate. Check your token.');
      }

      if (authResponse?.error) {
        const errObj = authResponse.error as Record<string, unknown>;
        throw new Error((errObj.message as string) || 'Invalid token');
      }

      const authorizeData = authResponse?.authorize as Record<string, unknown> | undefined;

      let finalBalance = 0;
      let currency = 'USD';

      try {
        const bal = await ws.getBalance();
        finalBalance = bal.balance || 0;
        currency = bal.currency || 'USD';
      } catch {
        const balanceData = authResponse?.balance as Record<string, unknown> | undefined;
        if (balanceData && typeof balanceData.balance === 'number') {
          finalBalance = balanceData.balance;
          currency = (balanceData.currency as string) || 'USD';
        } else if (authorizeData?.balance && typeof authorizeData.balance === 'number') {
          finalBalance = authorizeData.balance;
          currency = (authorizeData.currency as string) || 'USD';
        }
      }

      setBalance(finalBalance, currency);
      setAuth(token.trim(), (authorizeData?.is_virtual as boolean) || false);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAppId = () => {
    if (!appId.trim()) {
      setError('Please enter a valid App ID');
      return;
    }
    localStorage.setItem('deriv_bot_app_id', appId.trim());
    setError('');
  };

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-blue to-brand-emerald flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-blue/20">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">DerivBot</h1>
          <p className="text-brand-muted text-sm mt-1">AI-Powered Trading Bot</p>
        </div>

        <div className="glass-card p-6 sm:p-8 space-y-6">
          <div className="space-y-3">
            <p className="text-xs text-brand-muted text-center">Login with your Deriv account credentials</p>

            <button
              onClick={() => handleOAuthLogin(true)}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 hover:bg-yellow-500/25 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Connect Demo Account
            </button>

            <button
              onClick={() => handleOAuthLogin(false)}
              className="w-full py-3 rounded-xl text-sm font-semibold btn-primary flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Connect Real Account
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-brand-card px-3 text-brand-muted">or use API token</span>
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your Deriv API token"
              className="input-field text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleTokenLogin()}
            />
            <button
              onClick={handleTokenLogin}
              disabled={loading || !token.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-brand-muted border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Connecting...
                </span>
              ) : (
                'Connect with Token'
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
              {error}
            </div>
          )}

          <details className="text-[10px] text-brand-muted">
            <summary className="cursor-pointer hover:text-brand-blue transition-colors">Advanced: Change App ID</summary>
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="Deriv App ID"
                className="input-field text-xs"
              />
              <button
                onClick={handleSaveAppId}
                className="w-full py-1.5 rounded-lg text-xs font-medium bg-white/5 text-brand-muted border border-white/10 hover:bg-white/10 transition-colors"
              >
                Save
              </button>
              <p className="text-[9px] text-brand-muted/60">
                Get your App ID from <a href="https://api.deriv.com/my-apps" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">api.deriv.com/my-apps</a>
                {' '} &middot; Redirect URI must be: <span className="text-brand-blue">{DERIV_REDIRECT_URI}</span>
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
