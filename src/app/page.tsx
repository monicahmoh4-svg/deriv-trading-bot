'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const { setAuth } = useStore();

  useEffect(() => {
    const url = window.location.href;

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

    const params = new URLSearchParams(window.location.search);
    const token1 = params.get('token1');
    if (token1) {
      setAuth(token1, false);
      router.replace('/dashboard');
      return;
    }

    for (const [key, value] of params.entries()) {
      if (key.endsWith('_token') || key === 'token') {
        setAuth(value, false);
        router.replace('/dashboard');
        return;
      }
    }

    if (url.includes('#token1=')) {
      const hashIdx = url.indexOf('#token1=');
      const afterToken = url.substring(hashIdx + 9);
      const tokenEnd = afterToken.indexOf('&');
      const token = tokenEnd > -1 ? afterToken.substring(0, tokenEnd) : afterToken;
      if (token) {
        setAuth(decodeURIComponent(token), false);
        router.replace('/dashboard');
        return;
      }
    }

    router.replace('/login');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
