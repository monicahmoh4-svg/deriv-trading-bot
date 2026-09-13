'use client';

import { useStore } from '@/lib/store';

export default function ActivityLog() {
  const { activities, clearActivities } = useStore();

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'scan':
        return '🔍';
      case 'signal':
        return '📡';
      case 'trade':
        return '💹';
      case 'error':
        return '❌';
      default:
        return 'ℹ️';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'scan':
        return 'text-deriv-blue';
      case 'signal':
        return 'text-deriv-cyan';
      case 'trade':
        return 'text-deriv-green';
      case 'error':
        return 'text-deriv-red';
      default:
        return 'text-deriv-muted';
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-deriv-text">Activity Log</h2>
        {activities.length > 0 && (
          <button
            onClick={clearActivities}
            className="text-xs text-deriv-muted hover:text-deriv-red transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="text-center text-deriv-muted py-8">
            No activity yet
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-deriv-darker/50 transition-colors"
            >
              <span className="text-sm">{getTypeIcon(activity.type)}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${getTypeColor(activity.type)}`}>
                  {activity.message}
                </p>
                <p className="text-xs text-deriv-muted">
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
