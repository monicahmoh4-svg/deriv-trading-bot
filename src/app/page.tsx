'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const { login, setBalance } = useStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token1 = params.get('token1');

    if (token1) {
      login(token1, false);
      router.replace('/dashboard');
      return;
    }

    const hash = window.location.hash;
    if (hash.includes('token1=')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const hashToken = hashParams.get('token1');
      if (hashToken) {
        login(hashToken, false);
        router.replace('/dashboard');
        return;
      }
    }

    const allParams = new URLSearchParams(window.location.search);
    for (const [key, value] of allParams.entries()) {
      if (key.endsWith('_token') || key === 'token') {
        login(value, false);
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
