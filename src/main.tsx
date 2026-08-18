// src/main.tsx

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// ? ?? ????? Buffer ?? ???????
import { Buffer } from 'buffer';
window.Buffer = Buffer;

// ? ?? ????? global
if (typeof window !== 'undefined') {
  (window as any).global = window;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);