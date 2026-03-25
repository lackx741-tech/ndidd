import Link from 'next/link';

const stats = [
  { label: 'Total Value Locked', value: '$10M+' },
  { label: 'Token Holders', value: '5,000+' },
  { label: 'Governance Proposals', value: '42' },
];

const features = [
  { title: 'Token', desc: 'ERC-20 with permits, snapshots, and governance voting power.', href: '/tokens', icon: '🪙' },
  { title: 'NFT', desc: 'ERC-721 with batch minting, royalties, and on-chain metadata.', href: '/nft', icon: '🖼️' },
  { title: 'Vault', desc: 'ERC-4626 yield vault with strategy management and auto-compounding.', href: '/vault', icon: '🏦' },
  { title: 'Governance', desc: 'On-chain DAO with proposal creation, voting, and timelock execution.', href: '/governance', icon: '🗳️' },
  { title: 'Smart Wallet', desc: 'ERC-4337 account abstraction — gasless transactions via paymaster.', href: '/smart-wallet', icon: '🔐' },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center mb-20">
        <h1 className="text-5xl font-bold tracking-tight text-white mb-6">
          The Future of{' '}
          <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">DeFi</span>
        </h1>
        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
          Enterprise-grade Web3 infrastructure. Token, NFT, Vault, Governance, and Account Abstraction — all in one protocol.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/dashboard" className="rounded-lg bg-primary-600 px-6 py-3 text-white font-medium hover:bg-primary-700 transition-colors">Launch App</Link>
          <Link href="/smart-wallet" className="rounded-lg border border-zinc-700 bg-zinc-800 px-6 py-3 text-white font-medium hover:bg-zinc-700 transition-colors">Smart Wallet</Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-20">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            <div className="text-3xl font-bold text-white mb-1">{s.value}</div>
            <div className="text-sm text-zinc-400">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
        {features.map((f) => (
          <Link key={f.title} href={f.href} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 hover:border-zinc-600 transition-colors group">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary-400 transition-colors">{f.title}</h3>
            <p className="text-sm text-zinc-400">{f.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
