'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import {
  generatePKCEParams,
  buildAuthUrl,
  storePKCEParams,
  getStoredCodeVerifier,
  getStoredState,
  clearPKCEParams,
} from '@/lib/pkce';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, setDemo, auth } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_DERIV_CLIENT_ID || '34ohVmckD1DKsGsTMRY7L';
  const redirectUri = process.env.NEXT_PUBLIC_DERIV_REDIRECT_URI || (typeof window !== 'undefined' ? window.location.origin : '');

  const handleTokenExchange = useCallback(async (code: string, state: string) => {
    const storedState = getStoredState();
    if (state !== storedState) {
      setError('Security validation failed. Please try again.');
      clearPKCEParams();
      return;
    }

    const codeVerifier = getStoredCodeVerifier();
    if (!codeVerifier) {
      setError('Session expired. Please try again.');
      clearPKCEParams();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
          client_id: clientId,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Token exchange failed');
      }

      const accessToken = data.access_token;
      if (!accessToken) {
        throw new Error('No access token received');
      }

      const storedDemo = localStorage.getItem('deriv_login_demo') === 'true';
      setAuth(accessToken, storedDemo);
      localStorage.removeItem('deriv_login_demo');
      clearPKCEParams();
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      clearPKCEParams();
    } finally {
      setLoading(false);
    }
  }, [clientId, redirectUri, setAuth, router]);

  useEffect(() => {
    if (auth.token) {
      router.replace('/dashboard');
      return;
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const authError = searchParams.get('error');

    if (authError) {
      setError('Authorization was denied or cancelled.');
      clearPKCEParams();
      return;
    }

    if (code && state) {
      handleTokenExchange(code, state);
    }
  }, [searchParams, auth.token, router, handleTokenExchange]);

  const handleLogin = async (demo: boolean) => {
    setLoading(true);
    setError(null);
    localStorage.setItem('deriv_login_demo', demo.toString());
    setDemo(demo);

    try {
      const { codeVerifier, codeChallenge, state } = await generatePKCEParams();
      storePKCEParams({ codeVerifier, codeChallenge, state });

      const authUrl = buildAuthUrl(clientId, redirectUri, codeChallenge, state);
      window.location.href = authUrl;
    } catch {
      setError('Failed to initialize login. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="glass-card p-8 glow-border">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-deriv-cyan/20 rounded-2xl flex items-center justify-center">
              <svg className="w-10 h-10 text-deriv-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gradient">Deriv Trading Bot</h1>
          <p className="text-deriv-muted mt-2">Automated AI-powered algorithmic trading</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-deriv-red/10 border border-deriv-red/30 rounded-lg text-deriv-red text-sm">
            {error}
          </div>
        )}

        {loading && searchParams.get('code') ? (
          <div className="text-center py-8">
            <svg className="animate-spin h-10 w-10 text-deriv-cyan mx-auto mb-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-deriv-muted">Authenticating with Deriv...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => handleLogin(false)}
              disabled={loading}
              className="w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 bg-deriv-cyan hover:bg-deriv-cyan/80 text-deriv-dark disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Connecting...
                </>
              ) : (
                <>
                  <span className="w-3 h-3 rounded-full bg-deriv-green"></span>
                  Login with Deriv (Real Account)
                </>
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-deriv-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-deriv-card text-deriv-muted">or</span>
              </div>
            </div>

            <button
              onClick={() => handleLogin(true)}
              disabled={loading}
              className="w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 border-2 border-deriv-yellow/50 text-deriv-yellow hover:bg-deriv-yellow/10 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span className="w-3 h-3 rounded-full bg-deriv-yellow"></span>
              Login with Deriv (Demo Account)
            </button>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2 text-deriv-muted text-sm">
            <svg className="w-4 h-4 text-deriv-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Real-time market data analysis</span>
          </div>
          <div className="flex items-center gap-2 text-deriv-muted text-sm">
            <svg className="w-4 h-4 text-deriv-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>AI-powered signal generation</span>
          </div>
          <div className="flex items-center gap-2 text-deriv-muted text-sm">
            <svg className="w-4 h-4 text-deriv-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Autonomous trade execution</span>
          </div>
          <div className="flex items-center gap-2 text-deriv-muted text-sm">
            <svg className="w-4 h-4 text-deriv-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Secure PKCE OAuth2 connection</span>
          </div>
        </div>
      </div>

      <p className="text-center text-deriv-muted text-xs mt-4">
        By logging in, you agree to the terms of service
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-deriv-darker px-4">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-deriv-darker">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-deriv-cyan"></div>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
