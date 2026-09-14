'use client';

import { useStore } from '@/lib/store';

export default function BotToggle() {
  const { bot, toggleBot } = useStore();

  return (
    <button
      onClick={toggleBot}
      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 text-sm font-medium ${
        bot.isActive
          ? 'bg-deriv-green/20 text-deriv-green border border-deriv-green/30'
          : 'bg-deriv-darker text-deriv-muted border border-deriv-border hover:border-deriv-cyan/30'
      }`}
    >
      <div
        className={`w-3 h-3 rounded-full transition-all duration-300 ${
          bot.isActive
            ? 'bg-deriv-green shadow-[0_0_8px_rgba(0,230,118,0.5)]'
            : 'bg-deriv-border'
        }`}
      />
      <span className="hidden sm:inline">{bot.isActive ? 'Bot ON' : 'Bot OFF'}</span>
      {bot.isActive && (
        <div className="absolute inset-0 rounded-lg animate-pulse-slow bg-deriv-green/5 pointer-events-none" />
      )}
    </button>
  );
}
