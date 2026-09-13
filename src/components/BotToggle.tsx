'use client';

import { useStore } from '@/lib/store';

export default function BotToggle() {
  const { bot, toggleBot } = useStore();

  return (
    <button
      onClick={toggleBot}
      className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
        bot.isActive
          ? 'bg-deriv-green shadow-[0_0_15px_rgba(0,230,118,0.4)]'
          : 'bg-deriv-border'
      }`}
    >
      <div
        className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all duration-300 ${
          bot.isActive ? 'left-9' : 'left-1'
        }`}
      />
      {bot.isActive && (
        <div className="absolute inset-0 rounded-full animate-pulse-slow bg-deriv-green/30" />
      )}
    </button>
  );
}
