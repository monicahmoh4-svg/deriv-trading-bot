'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { getDerivWebSocket } from '@/lib/deriv-websocket';
import { initiateLogin, handleOAuthCallback, cleanupUrl } from '@/lib/deriv-auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, setDemo, auth } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<'real' | 'demo' | 'token' | null>(null);

  const clientId = process.env.NEXT_PUBLIC_DERIV_APP_ID || '34ohVmckD1DKsGsTMRY7L';
  const redirectUri = typeof window !== 'undefined' ? window.location.origin : '';

  const handleTokenAuth = useCallback(async (token: string, isDemo: boolean) => {
    if (!token.trim()) {
      setError('Please enter your API token.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ws = getDerivWebSocket();
      await ws.connect();
      const authResponse = await ws.authenticate(token.trim()) as {
        error?: { code?: string; message?: string };
        authorize?: { loginid?: string; email?: string };
        balance?: { balance?: number; currency?: string } | number;
        currency?: string;
        loginid?: string;
      };

      if (authResponse?.error) {
        throw new Error(authResponse.error.message || 'Invalid token');
      }

      setAuth(token.trim(), isDemo);

      const balanceData = authResponse?.balance;
      if (balanceData && typeof balanceData === 'object' && 'balance' in balanceData) {
        useStore.getState().setBalance(
          balanceData.balance || 0,
          balanceData.currency || authResponse?.currency || 'USD'
        );
      }

      router.replace('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(`Connection failed: ${msg}`);
      setLoading(false);
    }
  }, [setAuth, router]);

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
      cleanupUrl();
      return;
    }

    if (code && state) {
      setLoading(true);
      const storedMode = localStorage.getItem('deriv_login_mode');
      const isDemo = storedMode === 'demo';
      setDemo(isDemo);

      handleOAuthCallback(window.location.href, {
        clientId,
        redirectUri,
        scopes: 'trade',
      })
        .then((authInfo) => {
          setAuth(authInfo.access_token, isDemo);
          localStorage.removeItem('deriv_login_mode');
          router.replace('/dashboard');
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'OAuth callback failed');
          setLoading(false);
        });
      return;
    }

    const hash = window.location.hash;
    if (hash && hash.includes('token1=')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const token1 = hashParams.get('token1');
      if (token1) {
        const storedMode = localStorage.getItem('deriv_login_mode');
        const isDemo = storedMode === 'demo';
        setAuth(token1, isDemo);
        localStorage.removeItem('deriv_login_mode');
        router.replace('/dashboard');
        return;
      }
    }
  }, [searchParams, auth.token, router, setAuth, setDemo, clientId, redirectUri]);

  const handleOAuthLogin = async (demo: boolean) => {
    setLoading(true);
    setError(null);
    localStorage.setItem('deriv_login_mode', demo ? 'demo' : 'real');
    setDemo(demo);

    try {
      await initiateLogin({
        clientId,
        redirectUri,
        scopes: 'trade',
      });
    } catch {
      setError('Failed to start login. Please try again or use API token.');
      setLoading(false);
    }
  };

  const handleManualToken = async () => {
    const token = prompt('Paste your Deriv API token (get it from https://app.deriv.com/dashboard/api-token):');
    if (token && token.trim()) {
      setTokenInput(token.trim());
      setSelectedMode('token');
    }
  };

  const handleTokenSubmit = () => {
    if (tokenInput.trim()) {
      handleTokenAuth(tokenInput, false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="glass-card p-6 glow-border">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-deriv-cyan to-deriv-green flex items-center justify-center shadow-[0_0_30px_rgba(0,212,255,0.2)]">
              <svg className="w-8 h-8 text-deriv-darker" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <h1 className="text-xl font-bold text-gradient">DerivBot</h1>
          <p className="text-deriv-muted text-sm mt-1">AI-Powered Trading Bot</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-deriv-red/10 border border-deriv-red/20 rounded-lg text-deriv-red text-sm">
            {error}
          </div>
        )}

        {loading && searchParams.get('code') ? (
          <div className="text-center py-8">
            <svg className="animate-spin h-10 w-10 text-deriv-cyan mx-auto mb-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-deriv-muted text-sm">Authenticating with Deriv...</p>
          </div>
        ) : !selectedMode ? (
          <div className="space-y-3">
            <button
              onClick={() => handleOAuthLogin(false)}
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r from-deriv-cyan to-[#00b8d4] hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] text-deriv-darker disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-deriv-green"></span>
              Login with Deriv (Real Account)
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-deriv-border"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-[#111827] text-deriv-muted">or</span>
              </div>
            </div>

            <button
              onClick={() => handleOAuthLogin(true)}
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 border border-deriv-yellow/30 text-deriv-yellow hover:bg-deriv-yellow/5 hover:border-deriv-yellow/50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-deriv-yellow"></span>
              Login with Deriv (Demo Account)
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-deriv-border"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-[#111827] text-deriv-muted">or</span>
              </div>
            </div>

            <button
              onClick={handleManualToken}
              disabled={loading}
              className="w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 border border-deriv-purple/30 text-deriv-purple hover:bg-deriv-purple/5 hover:border-deriv-purple/50 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Connect with API Token
            </button>
          </div>
        ) : selectedMode === 'token' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 bg-[#0a0e17] rounded-lg border border-deriv-border/50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-deriv-purple"></span>
                <span className="text-sm font-medium text-deriv-text">API Token</span>
              </div>
              <button
                onClick={() => { setSelectedMode(null); setError(null); setTokenInput(''); }}
                className="text-xs text-deriv-muted hover:text-deriv-cyan transition-colors"
              >
                Change
              </button>
            </div>

            <div>
              <label className="block text-xs text-deriv-muted mb-1.5">API Token</label>
              <textarea
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste your Deriv API token here..."
                className="input-field min-h-[70px] text-sm font-mono"
                disabled={loading}
              />
              <p className="mt-1 text-[10px] text-deriv-muted">
                Get your token from{' '}
                <a
                  href="https://app.deriv.com/dashboard/api-token"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-deriv-cyan hover:underline"
                >
                  Deriv Dashboard
                </a>
              </p>
            </div>

            <button
              onClick={handleTokenSubmit}
              disabled={loading || !tokenInput.trim()}
              className="w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 bg-gradient-to-r from-deriv-cyan to-[#00b8d4] hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] text-deriv-darker disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Connecting...
                </>
              ) : (
                'Connect to Deriv'
              )}
            </button>

            <button
              onClick={() => { setSelectedMode(null); setError(null); setTokenInput(''); }}
              disabled={loading}
              className="w-full py-2 text-xs text-deriv-muted hover:text-deriv-text transition-colors"
            >
              Back
            </button>
          </div>
        ) : null}

        <div className="mt-5 space-y-2">
          {[
            'Real-time market data from all Deriv markets',
            'AI-powered signal generation with ML learning',
            'Autonomous trade execution on strong signals',
            'Secure OAuth2 / API token connection',
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-2 text-deriv-muted text-xs">
              <svg className="w-3.5 h-3.5 text-deriv-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060a12] px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-deriv-cyan/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-deriv-green/5 rounded-full blur-3xl" />
      </div>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-deriv-darker">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-deriv-cyan"></div>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
