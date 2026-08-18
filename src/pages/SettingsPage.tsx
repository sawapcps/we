// src/pages/SettingsPage.tsx

import { useApp } from '@/context/AppContext';
import { Database, Brain, Bell, Server, Globe, Users, Shield } from 'lucide-react';

export function SettingsPage() {
  const { botConfig, setBotConfig, addLog } = useApp();

  const updateConfig = (patch: Partial<typeof botConfig>) => {
    if (botConfig) {
      setBotConfig({ ...botConfig, ...patch });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">⚙️ الإعدادات</h1>
        <p className="text-sm text-slate-400 mt-1">إعدادات البوت ومصادر البيانات والذكاء الاصطناعي</p>
      </div>

      {/* Data sources */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">مصادر البيانات</h2>
        </div>
        <div className="space-y-3">
          <SourceRow
            title="DEX Screener API"
            desc="بيانات الأسعار والحجم والسيولة من البورصات اللامركزية"
            enabled={true}
            onToggle={() => {}}
          />
          <SourceRow
            title="GeckoTerminal API"
            desc="اكتشاف العملات عبر جميع الشبكات - المجموعات الرائجة والجديدة"
            enabled={true}
            onToggle={() => {}}
          />
          <SourceRow
            title="Gemini AI"
            desc="نماذج Google Gemini لتحليل العملات وإشارات التداول"
            enabled={true}
            onToggle={() => {}}
          />
        </div>
      </div>

      {/* Bot Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Server className="w-5 h-5 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">إعدادات البوت</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">وضع التداول</span>
            <span className="text-sm font-medium text-white">{botConfig?.mode || 'AUTO'}</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">الشبكات النشطة</span>
            <span className="text-sm text-white">{botConfig?.networks?.join(', ') || 'solana'}</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">السيولة الدنيا</span>
            <span className="text-sm text-white">${botConfig?.minLiquidity?.toLocaleString() || '50,000'}</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">الحجم الأدنى (24h)</span>
            <span className="text-sm text-white">${botConfig?.minVolume?.toLocaleString() || '100,000'}</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">الحد الأقصى للصفقة</span>
            <span className="text-sm text-white">${botConfig?.maxPositionSize || '100'}</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">جني الأرباح</span>
            <span className="text-sm text-white">{botConfig?.takeProfit || '15'}%</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">وقف الخسارة</span>
            <span className="text-sm text-white">{botConfig?.stopLoss || '5'}%</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">الحد الأقصى للصفقات اليومية</span>
            <span className="text-sm text-white">{botConfig?.maxTradesPerDay || '10'}</span>
          </div>
        </div>
      </div>

      {/* ✅ وضع التداول (مجمع/فردي) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">إعدادات المستخدمين</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <div>
              <span className="text-sm text-slate-400">وضع التداول</span>
              <p className="text-xs text-slate-500">
                {botConfig?.tradeMode === 'individual' 
                  ? '👤 فردي: كل مستخدم له حد صفقات خاص به' 
                  : '🔄 مشترك: جميع المستخدمين يتشاركون الحد اليومي'}
              </p>
            </div>
            <select
              value={botConfig?.tradeMode || 'shared'}
              onChange={(e) => updateConfig({ tradeMode: e.target.value as 'shared' | 'individual' })}
              className="px-3 py-1.5 bg-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="shared">🔄 مشترك</option>
              <option value="individual">👤 فردي</option>
            </select>
          </div>

          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <div>
              <span className="text-sm text-slate-400">نظام الأرباح</span>
              <p className="text-xs text-slate-500">85% للمستخدمين / 15% للخزانة</p>
            </div>
            <span className="text-sm font-medium text-emerald-400">85%</span>
          </div>
        </div>
      </div>

      {/* Backend info - MadarTech */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">قاعدة البيانات</h2>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">نظام قاعدة البيانات</span>
            <span className="text-sm font-mono text-white">MadarTech (Cloudflare D1 / SQLite)</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">تنفيذ الصفقات</span>
            <span className="text-sm text-white">MadarTech API (Jupiter / 1inch)</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">نماذج AI المتاحة</span>
            <span className="text-sm text-white">
              {"gemini-2.5-flash-lite -> 2.5-flash -> 1.5-flash -> 1.5-pro"}
            </span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">تخزين المفتاح الخاص</span>
            <span className="text-sm text-white">مشفر في MadarTech Database</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">الإشعارات</h2>
        </div>
        <div className="space-y-3">
          <SourceRow
            title="تنبيهات الصفقات"
            desc="إشعار عند تنفيذ البوت لصفقة جديدة"
            enabled={true}
            onToggle={() => {}}
          />
          <SourceRow
            title="تنبيهات تحليل AI"
            desc="إشعار عند اكتمال تحليل الذكاء الاصطناعي"
            enabled={true}
            onToggle={() => {}}
          />
          <SourceRow
            title="تنبيهات صوتية"
            desc="تشغيل صوت عند تنفيذ الصفقات والتنبيهات"
            enabled={false}
            onToggle={() => {}}
          />
        </div>
      </div>
    </div>
  );
}

function SourceRow({ title, desc, enabled, onToggle }: {
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onToggle(!enabled)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
      >
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}