/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_MADARTECH_API_URL?: string;
  readonly VITE_MADARTECH_DB_ID?: string;
  readonly VITE_JUPITER_API_KEY?: string;
  readonly VITE_WORKER_URL?: string;
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// ============================================================
// ?? Types ääåÍÇáØ (Phantom, MetaMask)
// ============================================================

interface PhantomWallet {
  isPhantom?: boolean;
  connect: () => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  signTransaction: <T>(tx: T) => Promise<T>;
  signAllTransactions: <T>(txs: T[]) => Promise<T[]>;
  on: (event: string, handler: (args: unknown) => void) => void;
  publicKey?: { toString: () => string };
}

interface MetaMaskWallet {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, handler: (args: any) => void) => void;
  removeListener: (event: string, handler: (args: any) => void) => void;
  selectedAddress?: string;
  chainId?: string;
}

interface Window {
  solana?: PhantomWallet;
  ethereum?: MetaMaskWallet & {
    isMetaMask?: boolean;
    request: (args: { method: string; params?: any[] }) => Promise<any>;
  };
}