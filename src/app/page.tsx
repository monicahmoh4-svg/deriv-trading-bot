'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { getDerivAppId, DERIV_REDIRECT_URI } from '@/lib/deriv-websocket';

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
        setTimeout(() => router.replace('/login'), 2000);
        return;
      }

      if (code && state) {
        const storedState = sessionStorage.getItem('deriv_oauth_state');
        const codeVerifier = sessionStorage.getItem('deriv_code_verifier');

        sessionStorage.removeItem('deriv_oauth_state');
        sessionStorage.removeItem('deriv_code_verifier');

        if (state !== storedState) {
          setStatus('Security verification failed. Redirecting to login...');
          setTimeout(() => router.replace('/login'), 2000);
          return;
        }

        if (!codeVerifier) {
          setStatus('Session expired. Redirecting to login...');
          setTimeout(() => router.replace('/login'), 2000);
          return;
        }

        setStatus('Exchanging authorization code...');

        try {
          const clientId = getDerivAppId();
          if (!clientId) throw new Error('App ID not configured');

          const response = await fetch('/api/auth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              code_verifier: codeVerifier,
              client_id: clientId,
              redirect_uri: DERIV_REDIRECT_URI,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            const errMsg = (data as Record<string, unknown>).message || (data as Record<string, unknown>).error_description || 'Token exchange failed';
            throw new Error(typeof errMsg === 'string' ? errMsg : 'Token exchange failed');
          }

          const accessToken = (data as Record<string, unknown>).access_token as string;
          const refreshToken = (data as Record<string, unknown>).refresh_token as string;

          if (!accessToken) {
            throw new Error('No access token received');
          }

          if (refreshToken) {
            localStorage.setItem('deriv_refresh_token', refreshToken);
          }

          const { getDerivWebSocket } = await import('@/lib/deriv-websocket');
          const ws = getDerivWebSocket();
          await ws.connect();

          let authResponse: Record<string, unknown>;
          try {
            authResponse = (await ws.authenticate(accessToken)) as Record<string, unknown>;
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

          setBalance(finalBalance, currency);
          setAuth(accessToken, (authorizeData?.is_virtual as boolean) || false);

          setStatus('Login successful! Redirecting...');
          router.replace('/dashboard');
        } catch (err) {
          setStatus(err instanceof Error ? err.message : 'Login failed');
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
