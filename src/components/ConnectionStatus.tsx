'use client';

import { useStore } from '@/lib/store';

export default function ConnectionStatus() {
  const { connection } = useStore();

  const getStatusConfig = () => {
    switch (connection.status) {
      case 'authenticated': return { color: 'bg-emerald-400', textColor: 'text-emerald-400', label: 'Connected', ring: 'ring-emerald-400/20' };
      case 'connected': return { color: 'bg-yellow-400', textColor: 'text-yellow-400', label: 'Auth...', ring: 'ring-yellow-400/20' };
      case 'connecting': return { color: 'bg-yellow-400', textColor: 'text-yellow-400', label: 'Connecting...', ring: 'ring-yellow-400/20' };
      case 'error': return { color: 'bg-red-400', textColor: 'text-red-400', label: connection.error || 'Error', ring: 'ring-red-400/20' };
      default: return { color: 'bg-slate-500', textColor: 'text-slate-500', label: 'Offline', ring: 'ring-slate-500/20' };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 ring-1 ${config.ring}`} title={config.label}>
      <div className="relative">
        <div className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
        {(connection.status === 'connecting' || connection.status === 'connected') && (
          <div className={`absolute inset-0 w-1.5 h-1.5 rounded-full ${config.color} animate-ping opacity-50`} />
        )}
      </div>
      <span className={`hidden lg:inline text-[10px] font-medium ${config.textColor}`}>{config.label}</span>
    </div>
  );
}
