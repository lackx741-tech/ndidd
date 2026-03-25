import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/layout/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NdiddProtocol | Web3 DeFi Platform',
  description: 'Enterprise-grade DeFi protocol with token, NFT, vault, and governance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          <Header />
          <main className="min-h-screen bg-zinc-950">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
