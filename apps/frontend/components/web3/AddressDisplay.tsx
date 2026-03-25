'use client';
import { useState } from 'react';
import { useChainId } from 'wagmi';
import { formatAddress, getExplorerUrl } from '@/lib/utils';

export function AddressDisplay({ address }: { address: string }) {
  const chainId = useChainId();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <span className="inline-flex items-center gap-2 font-mono text-sm text-zinc-300">
      <a
        href={getExplorerUrl(chainId, address, 'address')}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-white"
      >
        {formatAddress(address)}
      </a>
      <button onClick={copy} className="text-zinc-500 hover:text-white text-xs" title="Copy address">
        {copied ? '✓' : '⎘'}
      </button>
    </span>
  );
}
