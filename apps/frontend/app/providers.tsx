'use client';

import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, polygon, arbitrum, optimism, base } from '@reown/appkit/networks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { ReactNode, useState } from 'react';
import { Toaster } from 'react-hot-toast';

// ── Reown AppKit configuration ────────────────────────────────────────────────
// Get your projectId at https://cloud.reown.com
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID';

const networks = [mainnet, polygon, arbitrum, optimism, base] as const;

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: true,
});

// Initialise AppKit (singleton — runs once on module load)
createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: 'NdiddProtocol',
    description: 'Enterprise-grade DeFi protocol with token, NFT, vault, and governance.',
    url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    icons: ['https://avatars.githubusercontent.com/u/179229932'],
  },
  features: {
    analytics: false,
    email: false,
    socials: [],
    emailShowWallets: false,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#7c3aed',
    '--w3m-border-radius-master': '8px',
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: '#18181b', color: '#fff', border: '1px solid #3f3f46' },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
