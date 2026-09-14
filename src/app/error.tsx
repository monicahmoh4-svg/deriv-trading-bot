'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const handleClearData = () => {
    try { localStorage.clear(); } catch {}
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="glass-card p-6 sm:p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
        <p className="text-brand-muted text-sm mb-6">
          {error.message || 'An unexpected error occurred'}
        </p>
        <div className="space-y-2">
          <button onClick={reset} className="w-full btn-primary text-sm">
            Try Again
          </button>
          <button onClick={handleClearData} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors">
            Clear Data &amp; Login
          </button>
        </div>
      </div>
    </div>
  );
}
