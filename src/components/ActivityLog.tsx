'use client';

import { useStore } from '@/lib/store';

export default function ActivityLog() {
  const { activities } = useStore();

  return (
    <div className="glass-card p-4 sm:p-6 card-premium">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Activity Log
        </h2>
        <span className="text-[10px] text-brand-muted">{activities.length} events</span>
      </div>

      <div className="space-y-1.5 max-h-64 sm:max-h-96 overflow-y-auto pr-1">
        {activities.length === 0 ? (
          <p className="text-brand-muted text-xs text-center py-4">No activity yet.</p>
        ) : (
          activities.slice().reverse().map((activity, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                activity.type === 'signal' ? 'bg-brand-blue'
                  : activity.type === 'trade' ? 'bg-brand-emerald'
                    : activity.type === 'error' ? 'bg-red-400'
                      : 'bg-slate-500'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-brand-text leading-relaxed truncate">{activity.message}</div>
                <div className="text-[10px] text-brand-muted mt-0.5">{new Date(activity.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
