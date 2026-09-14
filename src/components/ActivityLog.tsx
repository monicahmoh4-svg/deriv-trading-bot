'use client';

import { useStore } from '@/lib/store';

export default function ActivityLog() {
  const { activities, clearActivities } = useStore();

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'scan': return 'S';
      case 'signal': return '!';
      case 'trade': return 'T';
      case 'error': return 'X';
      default: return 'i';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'scan': return 'text-deriv-blue bg-deriv-blue/20';
      case 'signal': return 'text-deriv-cyan bg-deriv-cyan/20';
      case 'trade': return 'text-deriv-green bg-deriv-green/20';
      case 'error': return 'text-deriv-red bg-deriv-red/20';
      default: return 'text-deriv-muted bg-deriv-muted/20';
    }
  };

  return (
    <div className="glass-card p-4 lg:p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm lg:text-base font-semibold text-deriv-text">Activity Log</h2>
        {activities.length > 0 && (
          <button
            onClick={clearActivities}
            className="text-[10px] lg:text-xs text-deriv-muted hover:text-deriv-red transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-1.5 max-h-48 lg:max-h-96 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="text-center text-deriv-muted py-6 lg:py-8 text-sm">
            No activity yet
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-2 p-1.5 lg:p-2 rounded-lg hover:bg-deriv-darker/50 transition-colors"
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${getTypeColor(activity.type)}`}>
                {getTypeIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs lg:text-sm leading-snug ${getTypeColor(activity.type).split(' ')[0]}`}>
                  {activity.message}
                </p>
                <p className="text-[10px] lg:text-xs text-deriv-muted">
                  {new Date(activity.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
