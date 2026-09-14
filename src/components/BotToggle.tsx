'use client';

import { useStore } from '@/lib/store';

export default function BotToggle() {
  const { bot, toggleBot } = useStore();

  return (
    <button
      onClick={toggleBot}
      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-300 text-sm font-semibold border ${
        bot.isActive
          ? 'bg-deriv-green/20 text-deriv-green border-deriv-green/40 shadow-[0_0_12px_rgba(0,230,118,0.2)]'
          : 'bg-deriv-darker/80 text-deriv-muted border-deriv-border hover:border-deriv-cyan/30 hover:text-deriv-text'
      }`}
      title={bot.isActive ? 'Bot is running - click to stop' : 'Click to start bot'}
    >
      <div className="relative">
        <div
          className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
            bot.isActive
              ? 'bg-deriv-green shadow-[0_0_6px_rgba(0,230,118,0.6)]'
              : 'bg-deriv-border'
          }`}
        />
        {bot.isActive && (
          <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-deriv-green animate-ping opacity-40" />
        )}
      </div>
      <span className="hidden sm:inline text-xs">{bot.isActive ? 'RUNNING' : 'START BOT'}</span>
    </button>
  );
}
