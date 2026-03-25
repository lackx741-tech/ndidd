'use client';
import { useState } from 'react';
import { useWriteContract } from 'wagmi';
import { parseEther } from 'viem';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { NDIDDNFT_ABI, NFT_ADDRESS } from '@/lib/contracts';

export default function NFTPage() {
  const [quantity, setQuantity] = useState(1);
  const { writeContract, isPending } = useWriteContract();

  const mint = () =>
    writeContract({
      address: NFT_ADDRESS,
      abi: NDIDDNFT_ABI,
      functionName: 'publicMint',
      args: [BigInt(quantity)],
      value: parseEther((0.08 * quantity).toString()),
    });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-white mb-8">NFT Mint</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Mint NFT">
          <p className="text-zinc-400 mb-4">
            Price: <span className="text-white font-semibold">0.08 ETH</span> per NFT
          </p>
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 text-xl"
            >
              −
            </button>
            <span className="text-2xl font-bold text-white w-8 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(10, quantity + 1))}
              className="w-10 h-10 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 text-xl"
            >
              +
            </button>
          </div>
          <p className="text-zinc-400 mb-4">
            Total: <span className="text-white font-semibold">{(0.08 * quantity).toFixed(2)} ETH</span>
          </p>
          <Button onClick={mint} isLoading={isPending}>
            Mint {quantity} NFT{quantity > 1 ? 's' : ''}
          </Button>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-gradient-to-br from-purple-900 to-indigo-900 border border-zinc-700 flex items-center justify-center"
            >
              <span className="text-2xl font-bold text-white/40">#{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
