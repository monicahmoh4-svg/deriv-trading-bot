'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const token = useStore((s) => s.auth.token);

  useEffect(() => {
    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-deriv-darker">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-deriv-cyan"></div>
    </div>
  );
}
