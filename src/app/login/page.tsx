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
  const [showOAuth, setShowOAuth] = useState(false);

  const handleOAuthLogin = (isDemo: boolean) => {
    const app_id = DERIV_APP_ID;
    const redirectUri = DERIV_REDIRECT_URI.replace(/\/$/, '');
    const params = new URLSearchParams({
      app_id,
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
            <p className="text-xs text-brand-muted text-center mb-1">Connect with your Deriv Account</p>

            <div className="space-y-2">
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
                className="w-full py-3 rounded-xl text-sm font-semibold btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connecting...
                  </span>
                ) : (
                  'Connect & Start Trading'
                )}
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <button
                onClick={() => setShowOAuth(!showOAuth)}
                className="bg-brand-card px-3 text-brand-muted hover:text-brand-blue transition-colors cursor-pointer"
              >
                {showOAuth ? 'Hide OAuth setup' : 'OAuth login (requires app registration)'}
              </button>
            </div>
          </div>

          {showOAuth && (
            <div className="space-y-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <p className="text-[11px] text-brand-muted leading-relaxed">
                OAuth requires a registered Deriv app. If you have one, click below:
              </p>
              <button
                onClick={() => handleOAuthLogin(true)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 hover:bg-yellow-500/25 transition-colors"
              >
                Connect Demo Account (OAuth)
              </button>
              <button
                onClick={() => handleOAuthLogin(false)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-brand-blue/15 text-brand-blue border border-brand-blue/25 hover:bg-brand-blue/25 transition-colors"
              >
                Connect Real Account (OAuth)
              </button>
              <div className="text-[10px] text-brand-muted space-y-1 pt-1">
                <p className="font-semibold text-brand-text">Setup steps:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Go to <a href="https://api.deriv.com/my-apps" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">api.deriv.com/my-apps</a></li>
                  <li>Create an app, add redirect URI:</li>
                  <li className="pl-4 font-mono text-[9px] break-all">{DERIV_REDIRECT_URI}</li>
                  <li>Set <code className="bg-white/10 px-1 rounded">NEXT_PUBLIC_DERIV_APP_ID</code> in Vercel env vars</li>
                </ol>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
              {error}
            </div>
          )}

          <div className="text-[10px] text-brand-muted text-center space-y-1">
            <p>
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
            <p className="text-brand-muted/60">
              Go to Settings → API Token → Generate with Read + Trade access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
