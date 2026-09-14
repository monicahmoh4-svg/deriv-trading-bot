'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import DashboardComponent from '@/components/Dashboard';

export default function DashboardPage() {
  const router = useRouter();
  const { auth } = useStore();

  useEffect(() => {
    if (!auth.token) {
      router.replace('/login');
    }
  }, [auth.token, router]);

  if (!auth.token) {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <DashboardComponent />;
}
