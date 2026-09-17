'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

const REDIRECT_URI = 'https://deriv-trading-bot-two.vercel.app';
const STORAGE_KEY_APP_ID = 'deriv_bot_app_id';
const STORAGE_KEY_LANDING = 'deriv_bot_landing';

function getStoredAppId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY_APP_ID) || '';
}

function getStoredLanding(): string {
  if (typeof window === 'undefined') return '/';
  return localStorage.getItem(STORAGE_KEY_LANDING) || '/';
}

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, setBalance } = useStore();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [appId, setAppId] = useState('');
  const [step, setStep] = useState<'setup' | 'login'>('login');

  useEffect(() => {
    const stored = getStoredAppId();
    if (stored) {
      setAppId(stored);
      setStep('login');
    }
  }, []);

  const handleOAuthLogin = useCallback((isDemo: boolean) => {
    if (!appId.trim()) {
      setError('Please enter your App ID first');
      return;
    }

    localStorage.setItem(STORAGE_KEY_APP_ID, appId.trim());
    localStorage.setItem(STORAGE_KEY_LANDING, window.location.href);

    const params = new URLSearchParams({
      app_id: appId.trim(),
      redirect_uri: REDIRECT_URI,
    });
    if (isDemo) {
      params.set('account_type', 'virtual');
    }

    window.location.href = `https://oauth.deriv.com/oauth2/authorize?${params.toString()}`;
  }, [appId]);

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

  const handleSaveAppId = () => {
    if (!appId.trim()) {
      setError('Please enter a valid App ID');
      return;
    }
    localStorage.setItem(STORAGE_KEY_APP_ID, appId.trim());
    setStep('login');
    setError('');
  };

  const handleClearAppId = () => {
    localStorage.removeItem(STORAGE_KEY_APP_ID);
    setAppId('');
    setStep('setup');
  };

  if (step === 'setup') {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-blue to-brand-emerald flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-blue/20">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">DerivBot</h1>
            <p className="text-brand-muted text-sm mt-1">One-time setup to enable login with your Deriv credentials</p>
          </div>

          <div className="glass-card p-6 sm:p-8 space-y-5">
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-white">Create Your Deriv App</h2>
              <ol className="text-xs text-brand-muted space-y-2 list-decimal list-inside">
                <li>
                  Click the button below to open the Deriv Application Manager
                </li>
                <li>
                  Click <span className="text-white font-medium">&quot;Register new application&quot;</span>
                </li>
                <li>
                  Enter any name (e.g. &quot;My Trading Bot&quot;), accept terms
                </li>
                <li>
                  In <span className="text-white font-medium">Redirect URL</span>, enter exactly:
                  <div className="mt-1 p-2 rounded-lg bg-white/5 border border-white/10 font-mono text-[10px] text-brand-blue break-all">
                    {REDIRECT_URI}
                  </div>
                </li>
                <li>
                  Select scopes: <span className="text-white font-medium">Read</span> and <span className="text-white font-medium">Trade</span>
                </li>
                <li>
                  Click Create, then copy the <span className="text-white font-medium">App ID</span> (numeric)
                </li>
              </ol>

              <a
                href="https://api.deriv.com/my-apps"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold btn-primary"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Deriv App Manager
              </a>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-brand-card px-3 text-brand-muted">paste your App ID below</span>
              </div>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="Deriv App ID (numeric, e.g. 12345)"
                className="input-field text-sm"
              />
              <button
                onClick={handleSaveAppId}
                disabled={!appId.trim()}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
              >
                Save App ID & Continue
              </button>
            </div>

            <p className="text-[10px] text-brand-muted text-center">
              Or{' '}
              <button onClick={() => { setStep('login'); }} className="text-brand-blue hover:text-brand-emerald transition-colors">
                use an API token instead
              </button>
            </p>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

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
            <p className="text-xs text-brand-muted text-center">Login with your Deriv account</p>

            <button
              onClick={() => handleOAuthLogin(true)}
              disabled={!appId.trim()}
              className="w-full py-3 rounded-xl text-sm font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 hover:bg-yellow-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Demo Account
            </button>

            <button
              onClick={() => handleOAuthLogin(false)}
              disabled={!appId.trim()}
              className="w-full py-3 rounded-xl text-sm font-semibold btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Real Account
            </button>

            {!appId.trim() && (
              <button
                onClick={() => setStep('setup')}
                className="w-full py-2 rounded-xl text-[11px] text-brand-blue border border-brand-blue/20 hover:bg-brand-blue/10 transition-colors"
              >
                First time? Setup your Deriv app (one-time)
              </button>
            )}
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

          <div className="text-[10px] text-brand-muted text-center space-y-1">
            {appId.trim() && (
              <p>
                App ID: <span className="text-brand-blue">{appId}</span>
                <button onClick={handleClearAppId} className="ml-2 text-brand-muted hover:text-red-400 transition-colors">
                  change
                </button>
              </p>
            )}
            <p>
              Get API token at{' '}
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
    </div>
  );
}
