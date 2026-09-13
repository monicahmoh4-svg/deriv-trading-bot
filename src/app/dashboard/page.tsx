'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import DashboardComponent from '@/components/Dashboard';

export default function DashboardPage() {
  const router = useRouter();
  const token = useStore((s) => s.auth.token);

  useEffect(() => {
    if (!token) {
      router.replace('/login');
    }
  }, [token, router]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-deriv-darker">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-deriv-cyan"></div>
      </div>
    );
  }

  return <DashboardComponent />;
}
