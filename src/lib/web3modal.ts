// src/lib/web3modal.ts
import { createWeb3Modal, defaultConfig } from '@web3modal/ethereum/react';
import { mainnet, arbitrum, polygon, base, bsc, avalanche, optimism } from 'wagmi/chains';

const projectId = '790863a9dc7199a37aabcb885399f435';

const chains = [mainnet, arbitrum, polygon, base, bsc, avalanche, optimism];

export const web3Modal = createWeb3Modal({
  projectId,
  chains,
  defaultConfig: defaultConfig({
    appName: 'CryptoBot',
    appDescription: 'Crypto trading platform',
    appUrl: 'https://hunter.madartech.uk',
    appIcon: 'https://hunter.madartech.uk/favicon.ico',
  }),
});