// src/components/TradingModeSelector.tsx

import React from 'react';

type TradingMode = 'AUTO' | 'MANUAL';

interface TradingModeSelectorProps {
  mode: TradingMode;
  onModeChange: (mode: TradingMode) => void;
  isRunning: boolean;
  onStartStop: () => void;
  disabled?: boolean;
}

export function TradingModeSelector({
  mode,
  onModeChange,
  isRunning,
  onStartStop,
  disabled = false,
}: TradingModeSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* AUTO Mode */}
        <button
          onClick={() => onModeChange('AUTO')}
          // ✅ إزالة disabled={isRunning}
          className={`p-6 rounded-xl border-2 text-left transition-all ${
            mode === 'AUTO'
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow-lg'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-3xl">🤖</span>
            <div>
              <h3 className="font-bold text-lg">تلقائي بالكامل</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                البوت يكتشف، يحلل، وينفذ الصفقات بنفسه
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                بدون تدخل بشري - يعمل 24/7
              </p>
            </div>
          </div>
          {mode === 'AUTO' && (
            <div className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
              ✅ الوضع النشط
            </div>
          )}
        </button>

        {/* MANUAL Mode */}
        <button
          onClick={() => onModeChange('MANUAL')}
          // ✅ إزالة disabled={isRunning}
          className={`p-6 rounded-xl border-2 text-left transition-all ${
            mode === 'MANUAL'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-3xl">🎯</span>
            <div>
              <h3 className="font-bold text-lg">يدوي</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                البوت يكتشف ويحلل ويعرض الفرص
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                وأنت تختار ما تنفذ
              </p>
            </div>
          </div>
          {mode === 'MANUAL' && (
            <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
              ✅ الوضع النشط
            </div>
          )}
        </button>
      </div>

      {/* Start/Stop Button */}
      <button
        onClick={onStartStop}
        disabled={disabled}
        className={`w-full py-3 rounded-lg font-medium transition-all ${
          isRunning
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-green-500 hover:bg-green-600 text-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isRunning ? '⏹️ إيقاف البوت' : '▶️ تشغيل البوت'}
      </button>

      {/* Status Info */}
      {isRunning && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm">
            <span className="animate-pulse text-green-500">●</span>
            <span className="text-gray-700 dark:text-gray-300">
              {mode === 'AUTO' ? (
                <>🤖 البوت يعمل تلقائياً... سينفذ الصفقات فوراً</>
              ) : (
                <>📊 البوت يعمل في وضع الاكتشاف... أنت من تختار الصفقات</>
              )}
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            ⏱️ دورة المسح: كل 5 دقائق
          </div>
        </div>
      )}
    </div>
  );
}