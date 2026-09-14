'use client';

import { useStore } from '@/lib/store';

export default function ConnectionStatus() {
  const { connection } = useStore();

  const getStatusConfig = () => {
    switch (connection.status) {
      case 'authenticated':
        return { color: 'bg-deriv-green', textColor: 'text-deriv-green', label: 'Connected', ring: 'ring-deriv-green/30' };
      case 'connected':
        return { color: 'bg-deriv-yellow', textColor: 'text-deriv-yellow', label: 'Auth...', ring: 'ring-deriv-yellow/30' };
      case 'connecting':
        return { color: 'bg-deriv-yellow', textColor: 'text-deriv-yellow', label: 'Connecting...', ring: 'ring-deriv-yellow/30' };
      case 'error':
        return { color: 'bg-deriv-red', textColor: 'text-deriv-red', label: connection.error || 'Error', ring: 'ring-deriv-red/30' };
      default:
        return { color: 'bg-deriv-muted', textColor: 'text-deriv-muted', label: 'Offline', ring: 'ring-deriv-muted/30' };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-deriv-darker/50 ring-1 ${config.ring}`} title={config.label}>
      <div className="relative">
        <div className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
        {connection.status === 'connecting' || connection.status === 'connected' ? (
          <div className={`absolute inset-0 w-1.5 h-1.5 rounded-full ${config.color} animate-ping opacity-50`} />
        ) : null}
      </div>
      <span className={`hidden lg:inline text-[10px] font-medium ${config.textColor}`}>{config.label}</span>
    </div>
  );
}
