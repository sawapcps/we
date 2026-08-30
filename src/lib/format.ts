// src/lib/format.ts

export function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function formatPrice(value: number | string | null): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return '—';
  
  // ✅ للأرقام الكبيرة (أكثر من 1 دولار)
  if (n >= 1) return `$${n.toFixed(4)}`;
  
  // ✅ للأرقام المتوسطة (بين 0.01 و 1 دولار)
  if (n >= 0.01) return `$${n.toFixed(6)}`;
  
  // ✅ للأرقام الصغيرة (بين 0.0001 و 0.01 دولار)
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  
  // ✅ للأرقام الصغيرة جداً (أقل من 0.0001)
  // نعرض 8 أرقام بعد الفاصلة بدلاً من التنسيق العلمي
  return `$${n.toFixed(8)}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0.00%';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}