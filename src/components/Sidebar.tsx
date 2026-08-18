import { useApp } from '@/context/AppContext';
import { NETWORKS, getNetworkColor } from '@/config/networks';
import { LayoutDashboard, TrendingUp, Bot, BrainCircuit, Wallet, Settings, Activity } from 'lucide-react';
import type { ReactNode } from 'react';

export type PageId = 'dashboard' | 'markets' | 'bot' | 'ai' | 'wallet' | 'settings';

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenNetworkSelector: () => void;
  children: ReactNode;
}

const NAV_ITEMS: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'markets', label: 'Markets', icon: TrendingUp },
  { id: 'bot', label: 'Bot Control', icon: Bot },
  { id: 'ai', label: 'AI Analysis', icon: BrainCircuit },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ activePage, onNavigate, onOpenNetworkSelector, children }: SidebarProps) {
  const { config, logs } = useApp();
  const activeNetworks = NETWORKS.filter((n) => config.networks.includes(n.id));
  const isRunning = config.status === 'running';

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">MadarTech</h1>
              <p className="text-xs text-slate-500">Trading Bot</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-slate-800 space-y-3">
          <button
            onClick={onOpenNetworkSelector}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors group"
          >
            <span className="text-xs font-medium text-slate-400 group-hover:text-white">Active Networks</span>
            <div className="flex items-center gap-1">
              {activeNetworks.slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getNetworkColor(n.id) }}
                  title={n.name}
                />
              ))}
              {activeNetworks.length > 5 && <span className="text-xs text-slate-500">+{activeNetworks.length - 5}</span>}
            </div>
          </button>

          <div className="flex items-center gap-2 px-3">
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-xs text-slate-500">
              {isRunning ? `Bot running · ${logs.length} logs` : 'Bot stopped'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
