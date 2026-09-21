'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { getDerivWebSocket } from '@/lib/deriv-websocket';

export default function Home() {
  const router = useRouter();
  const { setAuth, setBalance } = useStore();
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    const handleAuth = async () => {
      const params = new URLSearchParams(window.location.search);

      let token: string | null = null;
      let accountType: string | null = null;
      let currency: string | null = null;

      const token1 = params.get('token1');
      if (token1) {
        token = decodeURIComponent(token1);
        accountType = params.get('acct1');
        currency = params.get('cur1');
      }

      if (!token) {
        const hash = window.location.hash;
        if (hash) {
          const hashParams = new URLSearchParams(hash.substring(1));
          const hashToken = hashParams.get('token1');
          if (hashToken) {
            token = decodeURIComponent(hashToken);
            accountType = hashParams.get('acct1');
            currency = hashParams.get('cur1');
          }
        }
      }

      if (!token) {
        router.replace('/login');
        return;
      }

      setStatus('Authenticating with Deriv...');

      try {
        const ws = getDerivWebSocket();
        await ws.connect();

        let authResponse: Record<string, unknown>;
        try {
          authResponse = (await ws.authenticate(token)) as Record<string, unknown>;
        } catch {
          throw new Error('Failed to authenticate with Deriv');
        }

        if (authResponse?.error) {
          const errObj = authResponse.error as Record<string, unknown>;
          throw new Error((errObj.message as string) || 'Authentication failed');
        }

        const authorizeData = authResponse?.authorize as Record<string, unknown> | undefined;

        let finalBalance = 0;
        let finalCurrency = currency || 'USD';

        try {
          const bal = await ws.getBalance();
          finalBalance = bal.balance || 0;
          finalCurrency = bal.currency || finalCurrency;
        } catch {
          const balanceData = authResponse?.balance as Record<string, unknown> | undefined;
          if (balanceData && typeof balanceData.balance === 'number') {
            finalBalance = balanceData.balance;
            finalCurrency = (balanceData.currency as string) || finalCurrency;
          } else if (authorizeData?.balance && typeof authorizeData.balance === 'number') {
            finalBalance = authorizeData.balance;
            finalCurrency = (authorizeData.currency as string) || finalCurrency;
          }
        }

        const isVirtual = (accountType && accountType.startsWith('VRT')) ||
          (authorizeData?.is_virtual as boolean) ||
          (typeof authorizeData?.loginid === 'string' && (authorizeData.loginid as string).startsWith('VRT'));

        setBalance(finalBalance, finalCurrency);
        setAuth(token, isVirtual);

        const url = new URL(window.location.href);
        const paramsToRemove = ['token1', 'acct1', 'cur1', 'token2', 'acct2', 'cur2', 'token3', 'acct3', 'cur3', 'state'];
        paramsToRemove.forEach((p) => url.searchParams.delete(p));
        window.history.replaceState(window.history.state, '', url.pathname + url.search);

        setStatus('Login successful! Redirecting to dashboard...');
        router.replace('/dashboard');
      } catch (err) {
        console.error('Auth callback error:', err);
        setStatus(err instanceof Error ? err.message : 'Login failed');
        setTimeout(() => router.replace('/login'), 3000);
      }
    };

    handleAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-brand-muted text-sm">{status}</p>
      </div>
    </div>
  );
}
