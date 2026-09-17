'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { DERIV_APP_ID, DERIV_REDIRECT_URI } from '@/lib/deriv-websocket';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, setBalance } = useStore();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const REDIRECT_URI = DERIV_REDIRECT_URI;

  const handleOAuthLogin = (isDemo: boolean) => {
    const app_id = DERIV_APP_ID;
    const redirectUri = REDIRECT_URI.replace(/\/$/, '');
    const params = new URLSearchParams({
      app_id: app_id,
      redirect_uri: redirectUri,
    });
    if (isDemo) {
      params.set('account_type', 'virtual');
    }
    window.location.href = `https://oauth.deriv.com/oauth2/authorize?${params.toString()}`;
  };

  const handleTokenLogin = async () => {
    if (!token.trim()) {
      setError('Please enter a token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const wsModule = await import('@/lib/deriv-websocket');
      const ws = wsModule.getDerivWebSocket();
      await ws.connect();

      let authResponse: Record<string, unknown>;
      try {
        authResponse = (await ws.authenticate(token.trim())) as Record<string, unknown>;
      } catch {
        throw new Error('Failed to authenticate with token');
      }

      if (authResponse?.error) {
        const errObj = authResponse.error as Record<string, unknown>;
        throw new Error((errObj.message as string) || 'Invalid token');
      }

      const authorizeData = authResponse?.authorize as Record<string, unknown> | undefined;
      const balanceData = authResponse?.balance as Record<string, unknown> | undefined;

      let finalBalance = 0;
      let currency = 'USD';

      if (balanceData && typeof balanceData.balance === 'number') {
        finalBalance = balanceData.balance;
        currency = (balanceData.currency as string) || 'USD';
      } else if (authorizeData?.balance && typeof authorizeData.balance === 'number') {
        finalBalance = authorizeData.balance;
        currency = (authorizeData.currency as string) || 'USD';
      } else {
        try {
          const bal = await ws.getBalance();
          finalBalance = bal.balance || 0;
          currency = bal.currency || 'USD';
        } catch {}
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
            <p className="text-xs text-brand-muted text-center mb-2">Connect with Deriv Account</p>

            <button
              onClick={() => handleOAuthLogin(true)}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 hover:bg-yellow-500/25 transition-colors"
            >
              Connect Demo Account
            </button>

            <button
              onClick={() => handleOAuthLogin(false)}
              className="w-full py-3 rounded-xl text-sm font-semibold btn-primary"
            >
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
            <div>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your Deriv API token"
                className="input-field text-sm"
              />
            </div>
            <button
              onClick={handleTokenLogin}
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-brand-muted border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect with Token'}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
              {error}
            </div>
          )}

          <p className="text-[10px] text-brand-muted text-center">
            Get your API token at{' '}
            <a
              href="https://app.deriv.com/account/api-token"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-blue hover:text-brand-emerald transition-colors"
            >
              app.deriv.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
