'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { getDerivWebSocket } from '@/lib/deriv-websocket';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth, setDemo, auth } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<'real' | 'demo' | null>(null);

  useEffect(() => {
    if (auth.token) {
      router.replace('/dashboard');
      return;
    }

    const hash = window.location.hash;
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const token1 = hashParams.get('token1');
      if (token1) {
        const storedDemo = localStorage.getItem('deriv_login_demo') === 'true';
        setAuth(token1, storedDemo);
        localStorage.removeItem('deriv_login_demo');
        router.replace('/dashboard');
        return;
      }
    }
  }, [auth.token, router, setAuth]);

  const handleConnect = useCallback(async (token: string, isDemo: boolean) => {
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
        balance?: number;
        currency?: string;
        loginid?: string;
        email?: string;
        fullname?: string;
        is_virtual?: number;
      };

      if (authResponse?.error) {
        throw new Error(authResponse.error.message || 'Invalid token');
      }

      setAuth(token.trim(), isDemo);

      const accountType = authResponse?.is_virtual ? 'Demo' : 'Real';
      const accountId = authResponse?.loginid || '';
      router.replace('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      if (msg.includes('Invalid token') || msg.includes('handshake') || msg.includes('connected')) {
        setError('Invalid or expired API token. Please check your token and try again.');
      } else {
        setError(`Connection failed: ${msg}`);
      }
      setLoading(false);
    }
  }, [setAuth, router]);

  const handleQuickConnect = (mode: 'real' | 'demo') => {
    setSelectedMode(mode);
    setDemo(mode === 'demo');
    setTokenInput('');
    setError(null);
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
          <p className="text-deriv-muted mt-2">Connect your Deriv account to start trading</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-deriv-red/10 border border-deriv-red/30 rounded-lg text-deriv-red text-sm">
            {error}
          </div>
        )}

        {!selectedMode ? (
          <div className="space-y-4">
            <button
              onClick={() => handleQuickConnect('real')}
              className="w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 bg-deriv-cyan hover:bg-deriv-cyan/80 text-deriv-dark flex items-center justify-center gap-2"
            >
              <span className="w-3 h-3 rounded-full bg-deriv-green"></span>
              Connect Real Account
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
              onClick={() => handleQuickConnect('demo')}
              className="w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 border-2 border-deriv-yellow/50 text-deriv-yellow hover:bg-deriv-yellow/10 flex items-center justify-center gap-2"
            >
              <span className="w-3 h-3 rounded-full bg-deriv-yellow"></span>
              Connect Demo Account
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-deriv-darker/50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${selectedMode === 'real' ? 'bg-deriv-green' : 'bg-deriv-yellow'}`}></span>
                <span className="text-sm font-medium text-deriv-text">
                  {selectedMode === 'real' ? 'Real Account' : 'Demo Account'}
                </span>
              </div>
              <button
                onClick={() => { setSelectedMode(null); setError(null); }}
                className="text-xs text-deriv-muted hover:text-deriv-cyan transition-colors"
              >
                Change
              </button>
            </div>

            <div>
              <label className="block text-sm text-deriv-muted mb-2">API Token</label>
              <textarea
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste your Deriv API token here..."
                className="input-field min-h-[80px] text-sm font-mono"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-deriv-muted">
                Get your token from{' '}
                <a
                  href="https://app.deriv.com/dashboard/api-token"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-deriv-cyan hover:underline"
                >
                  Deriv Dashboard → API Token
                </a>
              </p>
            </div>

            <button
              onClick={() => handleConnect(tokenInput, selectedMode === 'demo')}
              disabled={loading || !tokenInput.trim()}
              className="w-full py-3 px-6 rounded-lg font-semibold transition-all duration-200 bg-deriv-cyan hover:bg-deriv-cyan/80 text-deriv-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Connect to Deriv
                </>
              )}
            </button>

            <button
              onClick={() => { setSelectedMode(null); setError(null); setTokenInput(''); }}
              disabled={loading}
              className="w-full py-2 text-sm text-deriv-muted hover:text-deriv-text transition-colors"
            >
              Back
            </button>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2 text-deriv-muted text-sm">
            <svg className="w-4 h-4 text-deriv-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Direct WebSocket connection to Deriv</span>
          </div>
          <div className="flex items-center gap-2 text-deriv-muted text-sm">
            <svg className="w-4 h-4 text-deriv-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Real-time AI-powered signal generation</span>
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
            <span>Your token never leaves your browser</span>
          </div>
        </div>
      </div>

      <p className="text-center text-deriv-muted text-xs mt-4">
        By connecting, you agree to the terms of service
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
