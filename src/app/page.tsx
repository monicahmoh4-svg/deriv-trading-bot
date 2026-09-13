'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useStore } from '@/lib/store';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useStore((s) => s.auth.token);

  useEffect(() => {
    const hash = window.location.hash;

    if (hash && hash.includes('token1=')) {
      router.replace(`/login${hash}`);
      return;
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (code && state) {
      router.replace(`/login?code=${code}&state=${state}`);
      return;
    }

    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [token, router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-deriv-darker">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-deriv-cyan"></div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-deriv-darker">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-deriv-cyan"></div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
