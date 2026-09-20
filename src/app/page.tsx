'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { getDerivAppId, DERIV_REDIRECT_URI, getDerivWebSocket } from '@/lib/deriv-websocket';
import { handleOAuthCallback, cleanupUrl } from '@/lib/auth';

export default function Home() {
  const router = useRouter();
  const { setAuth, setBalance } = useStore();
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    const handleAuth = async () => {
      const params = new URLSearchParams(window.location.search);

      const token1 = params.get('token1');
      if (token1) {
        setAuth(decodeURIComponent(token1), false);
        router.replace('/dashboard');
        return;
      }

      const hash = window.location.hash;
      if (hash && hash.includes('token1=')) {
        const hashParts = hash.substring(1).split('&');
        for (const part of hashParts) {
          const [key, value] = part.split('=');
          if (key === 'token1' && value) {
            setAuth(decodeURIComponent(value), false);
            router.replace('/dashboard');
            return;
          }
        }
      }

      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');

      if (error) {
        setStatus('Authorization denied. Redirecting to login...');
        cleanupUrl(window.location.origin);
        setTimeout(() => router.replace('/login'), 2000);
        return;
      }

      if (code && state) {
        setStatus('Exchanging authorization code for token...');

        try {
          const clientId = getDerivAppId();
          if (!clientId) throw new Error('App ID not configured');

          const authInfo = await handleOAuthCallback(window.location.href, {
            clientId,
            redirectUri: DERIV_REDIRECT_URI,
            scopes: 'trade',
          });

          if (!authInfo.access_token) {
            throw new Error('No access token received');
          }

          setStatus('Authenticating with Deriv WebSocket...');

          const ws = getDerivWebSocket();
          await ws.connect();

          let authResponse: Record<string, unknown>;
          try {
            authResponse = (await ws.authenticate(authInfo.access_token)) as Record<string, unknown>;
          } catch {
            throw new Error('Failed to authenticate with access token');
          }

          if (authResponse?.error) {
            const errObj = authResponse.error as Record<string, unknown>;
            throw new Error((errObj.message as string) || 'Authentication failed');
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
            }
          }

          const isVirtual = sessionStorage.getItem('deriv_account_type') === 'virtual' ||
            (authorizeData?.is_virtual as boolean) ||
            (typeof authorizeData?.loginid === 'string' && (authorizeData.loginid as string).startsWith('VRT'));

          setBalance(finalBalance, currency);
          setAuth(authInfo.access_token, isVirtual);

          setStatus('Login successful! Redirecting to dashboard...');
          router.replace('/dashboard');
        } catch (err) {
          console.error('OAuth callback error:', err);
          setStatus(err instanceof Error ? err.message : 'Login failed');
          cleanupUrl(window.location.origin);
          setTimeout(() => router.replace('/login'), 3000);
        }
        return;
      }

      router.replace('/login');
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
