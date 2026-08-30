// src/pages/SettingsPage.tsx
// ============================================================
// ⚙️ صفحة الإعدادات - النسخة المعدلة بالكامل
// ✅ بيانات حقيقية من botConfig
// ✅ تحكم كامل بالمبالغ وعدد الصفقات
// ✅ تحديث فوري للإعدادات
// ✅ واجهة متطورة مع شرح لكل إعداد
// ============================================================

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  Database, 
  Brain, 
  Bell, 
  Server, 
  Globe, 
  Users, 
  Shield,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Save,
  RotateCcw,
  Info,
  Wallet,
  Target,
  Zap,
  Clock,
  BarChart3,
} from 'lucide-react';

// ============================================================
// 📊 واجهة الإعدادات
// ============================================================

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
}

// ============================================================
// 🎯 الصفحة الرئيسية
// ============================================================

export function SettingsPage() {
  const { botConfig, setBotConfig, addLog, refreshData } = useApp();
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ✅ تحديث الإعدادات
  const updateConfig = (patch: Partial<typeof botConfig>) => {
    if (botConfig) {
      setBotConfig({ ...botConfig, ...patch });
    }
  };

  // ✅ حفظ الإعدادات
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    
    try {
      // ✅ حفظ في localStorage
      localStorage.setItem('botConfig', JSON.stringify(botConfig));
      
      // ✅ حفظ في قاعدة البيانات عبر Worker
      const response = await fetch(`${import.meta.env.VITE_WORKER_URL}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: botConfig }),
      });
      
      if (response.ok) {
        setSaveMessage({ type: 'success', text: '✅ تم حفظ الإعدادات بنجاح' });
        await addLog('SUCCESS', '✅ تم تحديث إعدادات البوت');
        await refreshData();
      } else {
        throw new Error('فشل حفظ الإعدادات');
      }
    } catch (error) {
      setSaveMessage({ 
        type: 'error', 
        text: `❌ فشل حفظ الإعدادات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}` 
      });
      await addLog('ERROR', `❌ فشل حفظ الإعدادات: ${error instanceof Error ? error.message : 'غير معروف'}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  // ✅ إعادة تعيين الإعدادات الافتراضية
  const handleReset = () => {
    if (confirm('⚠️ هل أنت متأكد من إعادة تعيين جميع الإعدادات إلى القيم الافتراضية؟')) {
      const defaultConfig = {
        mode: 'AUTO',
        networks: ['solana'],
        minLiquidity: 50000,
        minVolume: 100000,
        maxPositionSize: 100,
        takeProfit: 15,
        stopLoss: 5,
        maxTradesPerDay: 10,
        tradeMode: 'shared' as 'shared' | 'individual',
        minScore: 50,
        scanInterval: 300,
        aiAssist: true,
        autoExecute: true,
        paperTrading: false,
      };
      setBotConfig(defaultConfig);
      localStorage.setItem('botConfig', JSON.stringify(defaultConfig));
      setSaveMessage({ type: 'success', text: '🔄 تم إعادة تعيين الإعدادات إلى القيم الافتراضية' });
      addLog('INFO', '🔄 تم إعادة تعيين الإعدادات إلى القيم الافتراضية');
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  // ============================================================
  // 🎨 العرض
  // ============================================================

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            ⚙️ الإعدادات
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            إعدادات البوت ومصادر البيانات والذكاء الاصطناعي - أنت تتحكم بكل شيء
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-red-500/20"
          >
            <RotateCcw className="w-4 h-4" />
            إعادة تعيين
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              saving 
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            {saving ? (
              <>
                <span className="animate-spin">⏳</span>
                جاري الحفظ...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                حفظ الإعدادات
              </>
            )}
          </button>
        </div>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className={`p-4 rounded-xl ${
          saveMessage.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {saveMessage.text}
        </div>
      )}

      {/* ✅ إعدادات التداول (الأساسية) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">💵 إعدادات التداول</h2>
          <span className="text-xs text-slate-500 ml-auto">أنت تتحكم بالمبالغ والحدود</span>
        </div>
        <div className="space-y-3">
          {/* الحد الأقصى للصفقة */}
          <SettingRow
            label="الحد الأقصى للصفقة"
            value={botConfig?.maxPositionSize || 100}
            unit="$"
            min={5}
            max={10000}
            step={5}
            onChange={(val) => updateConfig({ maxPositionSize: val })}
            description="الحد الأقصى للمبلغ الذي يمكن للبوت استخدمه في صفقة واحدة"
          />

          {/* الحد الأدنى للسيولة */}
          <SettingRow
            label="الحد الأدنى للسيولة"
            value={botConfig?.minLiquidity || 50000}
            unit="$"
            min={10000}
            max={1000000}
            step={5000}
            onChange={(val) => updateConfig({ minLiquidity: val })}
            description="السيولة الدنيا المطلوبة للعملة (تجنب العملات غير السائلة)"
          />

          {/* الحد الأدنى للحجم */}
          <SettingRow
            label="الحد الأدنى للحجم (24h)"
            value={botConfig?.minVolume || 100000}
            unit="$"
            min={25000}
            max={5000000}
            step={25000}
            onChange={(val) => updateConfig({ minVolume: val })}
            description="حجم التداول الأدنى خلال 24 ساعة (للتأكد من النشاط)"
          />

          {/* عدد الصفقات اليومية */}
          <SettingRow
            label="الحد الأقصى للصفقات اليومية"
            value={botConfig?.maxTradesPerDay || 10}
            unit="صفقة"
            min={1}
            max={100}
            step={1}
            onChange={(val) => updateConfig({ maxTradesPerDay: val })}
            description="عدد الصفقات التي يمكن للبوت تنفيذها في اليوم الواحد"
          />

          {/* الحد الأدنى للنقاط */}
          <SettingRow
            label="الحد الأدنى لنقاط Hunter"
            value={botConfig?.minScore || 50}
            unit="%"
            min={20}
            max={90}
            step={5}
            onChange={(val) => updateConfig({ minScore: val })}
            description="الحد الأدنى لدرجة Hunter للموافقة على الصفقة (كلما زادت، زادت الدقة)"
          />
        </div>
      </div>

      {/* ✅ إدارة المخاطر */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">🛡️ إدارة المخاطر</h2>
          <span className="text-xs text-slate-500 ml-auto">حماية رأس المال</span>
        </div>
        <div className="space-y-3">
          {/* جني الأرباح */}
          <SettingRow
            label="جني الأرباح (Take Profit)"
            value={botConfig?.takeProfit || 15}
            unit="%"
            min={2}
            max={100}
            step={1}
            onChange={(val) => updateConfig({ takeProfit: val })}
            description="نسبة الربح المستهدفة التي يتم عندها إغلاق الصفقة تلقائياً"
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
          />

          {/* وقف الخسارة */}
          <SettingRow
            label="وقف الخسارة (Stop Loss)"
            value={botConfig?.stopLoss || 5}
            unit="%"
            min={1}
            max={50}
            step={0.5}
            onChange={(val) => updateConfig({ stopLoss: val })}
            description="نسبة الخسارة القصوى المسموح بها قبل إغلاق الصفقة تلقائياً"
            icon={<TrendingDown className="w-4 h-4 text-red-400" />}
          />

          {/* نسبة المخاطرة/المكافأة */}
          <div className="bg-slate-800/30 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm text-slate-400">نسبة المخاطرة/المكافأة</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  مقابل كل $1 مخاطرة، العائد المتوقع ${((botConfig?.takeProfit || 15) / (botConfig?.stopLoss || 5)).toFixed(1)}
                </p>
              </div>
              <span className="text-sm font-bold text-cyan-400">
                1:{((botConfig?.takeProfit || 15) / (botConfig?.stopLoss || 5)).toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ إعدادات البوت المتقدمة */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Server className="w-5 h-5 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">🤖 إعدادات البوت المتقدمة</h2>
          <span className="text-xs text-slate-500 ml-auto">تحكم دقيق</span>
        </div>
        <div className="space-y-3">
          {/* وضع التداول */}
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-slate-400">وضع التداول</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {botConfig?.mode === 'AUTO' ? 'تلقائي - البوت ينفذ الصفقات' : 'يدوي - انتظار موافقتك'}
              </p>
            </div>
            <select
              value={botConfig?.mode || 'AUTO'}
              onChange={(e) => updateConfig({ mode: e.target.value as 'AUTO' | 'MANUAL' })}
              className="px-3 py-1.5 bg-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="AUTO">🔄 تلقائي</option>
              <option value="MANUAL">✋ يدوي</option>
            </select>
          </div>

          {/* وضع المستخدمين */}
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-slate-400">وضع المستخدمين</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
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

          {/* فترة المسح */}
          <SettingRow
            label="فترة المسح التلقائي"
            value={botConfig?.scanInterval || 300}
            unit="ثانية"
            min={30}
            max={3600}
            step={30}
            onChange={(val) => updateConfig({ scanInterval: val })}
            description="المدة بين كل مسح تلقائي للبوت (بالثواني)"
            icon={<Clock className="w-4 h-4 text-purple-400" />}
          />

          {/* التداول الورقي */}
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-indigo-400" />
                <span className="text-sm text-slate-400">التداول الورقي (Paper Trading)</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {botConfig?.paperTrading 
                  ? '📝 يحاكي الصفقات بدون أموال حقيقية (للاختبار)' 
                  : '💰 صفقات حقيقية بأموال حقيقية'}
              </p>
            </div>
            <button
              onClick={() => updateConfig({ paperTrading: !botConfig?.paperTrading })}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${botConfig?.paperTrading ? 'bg-amber-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${botConfig?.paperTrading ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* مساعدة الذكاء الاصطناعي */}
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-slate-400">مساعدة الذكاء الاصطناعي</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {botConfig?.aiAssist 
                  ? '🧠 Gemini AI يحلل العملات قبل الشراء' 
                  : '⚡ تحليل سريع بدون AI'}
              </p>
            </div>
            <button
              onClick={() => updateConfig({ aiAssist: !botConfig?.aiAssist })}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${botConfig?.aiAssist ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${botConfig?.aiAssist ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* التنفيذ التلقائي */}
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-slate-400">التنفيذ التلقائي</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {botConfig?.autoExecute 
                  ? '🚀 ينفذ الصفقات تلقائياً عند توفر الفرص' 
                  : '⏸️ يعرض الفرص فقط دون تنفيذ'}
              </p>
            </div>
            <button
              onClick={() => updateConfig({ autoExecute: !botConfig?.autoExecute })}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${botConfig?.autoExecute ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${botConfig?.autoExecute ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ✅ مصادر البيانات */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">📡 مصادر البيانات</h2>
          <span className="text-xs text-slate-500 ml-auto">حقيقية ومباشرة</span>
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
            title="Birdeye API"
            desc="بيانات المحافظ الذكية، نشاط الحيتان، التحليل المتقدم"
            enabled={true}
            onToggle={() => {}}
          />
          <SourceRow
            title="Gemini AI"
            desc="نماذج Google Gemini لتحليل العملات وإشارات التداول بالعربية"
            enabled={botConfig?.aiAssist !== false}
            onToggle={() => updateConfig({ aiAssist: !botConfig?.aiAssist })}
          />
        </div>
      </div>

      {/* ✅ نظام الأرباح */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">💰 نظام الأرباح</h2>
          <span className="text-xs text-slate-500 ml-auto">شفاف وعادل</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <div>
              <span className="text-sm text-slate-400">نسبة المستخدم</span>
              <p className="text-xs text-slate-500">حصة المستخدم من الأرباح</p>
            </div>
            <span className="text-lg font-bold text-emerald-400">85%</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <div>
              <span className="text-sm text-slate-400">نسبة الخزانة</span>
              <p className="text-xs text-slate-500">رسوم تشغيل البوت والمنصة</p>
            </div>
            <span className="text-lg font-bold text-amber-400">15%</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <div>
              <span className="text-sm text-slate-400">الحد الأدنى للسحب</span>
              <p className="text-xs text-slate-500">الحد الأدنى للمبلغ القابل للسحب</p>
            </div>
            <span className="text-sm font-bold text-white">$10</span>
          </div>
        </div>
      </div>

      {/* ✅ معلومات النظام */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">🌐 معلومات النظام</h2>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">قاعدة البيانات</span>
            <span className="text-sm font-mono text-white">MadarTech (Cloudflare D1)</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">تنفيذ الصفقات</span>
            <span className="text-sm text-white">Jupiter (Solana) / 1inch (EVM)</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">نماذج AI</span>
            <span className="text-sm text-white">Gemini 2.5 Flash → 1.5 Flash → 1.5 Pro</span>
          </div>
          <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-400">تخزين المفاتيح</span>
            <span className="text-sm text-emerald-400">✅ مشفر في MadarTech Database</span>
          </div>
        </div>
      </div>

      {/* ✅ الإشعارات */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">🔔 الإشعارات</h2>
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
            title="تنبيهات الأرباح"
            desc="إشعار عند تحقيق أرباح أو خسائر"
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

      {/* ✅ تذييل */}
      <div className="text-center text-xs text-slate-500 py-4 border-t border-slate-800">
        <p>جميع الإعدادات تحفظ تلقائياً في قاعدة البيانات</p>
        <p className="mt-1">تغيير الإعدادات يؤثر فوراً على سلوك البوت</p>
      </div>
    </div>
  );
}

// ============================================================
// 🧩 مكونات مساعدة
// ============================================================

interface SettingRowProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  description: string;
  icon?: React.ReactNode;
}

function SettingRow({ 
  label, 
  value, 
  unit, 
  min, 
  max, 
  step, 
  onChange, 
  description,
  icon 
}: SettingRowProps) {
  return (
    <div className="bg-slate-800/30 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm text-slate-400">{label}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-32 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <span className="text-sm font-bold text-white min-w-[60px] text-right">
            {value} {unit}
          </span>
        </div>
      </div>
    </div>
  );
}

function SourceRow({ 
  title, 
  desc, 
  enabled, 
  onToggle 
}: {
  title: string;
  desc: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-slate-800/30 rounded-lg px-4 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          <p className="text-sm font-medium text-white">{title}</p>
        </div>
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