'use client';

import { useStore } from '@/lib/store';

export default function BotToggle() {
  const { bot, toggleBot } = useStore();

  return (
    <button
      onClick={toggleBot}
      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
        bot.isActive
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
          : 'bg-white/5 text-brand-muted border border-white/10 hover:border-white/20 hover:text-white'
      }`}
      title={bot.isActive ? 'Bot running - click to stop' : 'Click to start bot'}
    >
      <div className="relative">
        <div className={`w-2 h-2 rounded-full transition-all ${bot.isActive ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-brand-muted'}`} />
        {bot.isActive && <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-40" />}
      </div>
      <span className="hidden sm:inline">{bot.isActive ? 'RUNNING' : 'START BOT'}</span>
    </button>
  );
}
