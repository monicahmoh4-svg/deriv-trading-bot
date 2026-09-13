'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DerivBot Error]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-deriv-darker px-4">
      <div className="glass-card p-8 glow-border max-w-md w-full text-center">
        <div className="w-16 h-16 bg-deriv-red/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-deriv-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-deriv-text mb-2">Something went wrong</h2>
        <p className="text-deriv-muted text-sm mb-6">
          {error.message || 'An unexpected error occurred.'}
        </p>
        {error.digest && (
          <p className="text-deriv-muted text-xs mb-4">Error ID: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2 rounded-lg bg-deriv-cyan hover:bg-deriv-cyan/80 text-deriv-dark font-semibold transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('deriv-trading-bot-storage');
              window.location.href = '/login';
            }}
            className="px-6 py-2 rounded-lg border border-deriv-border text-deriv-muted hover:text-deriv-text hover:bg-deriv-border/50 transition-colors"
          >
            Clear Data &amp; Login
          </button>
        </div>
      </div>
    </div>
  );
}
