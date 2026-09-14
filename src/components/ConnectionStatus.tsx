'use client';

import { useStore } from '@/lib/store';

export default function ConnectionStatus() {
  const { connection } = useStore();

  const getStatusConfig = () => {
    switch (connection.status) {
      case 'authenticated':
        return { color: 'bg-deriv-green', pulse: true, label: 'Connected' };
      case 'connected':
        return { color: 'bg-deriv-yellow', pulse: true, label: 'Authenticating...' };
      case 'connecting':
        return { color: 'bg-deriv-yellow', pulse: true, label: 'Connecting...' };
      case 'error':
        return { color: 'bg-deriv-red', pulse: false, label: connection.error || 'Error' };
      default:
        return { color: 'bg-deriv-muted', pulse: false, label: 'Disconnected' };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-1.5" title={config.label}>
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.pulse && (
          <div className={`absolute inset-0 w-2 h-2 rounded-full ${config.color} animate-ping opacity-75`} />
        )}
      </div>
      <span className="hidden lg:inline text-[10px] text-deriv-muted">{config.label}</span>
    </div>
  );
}
