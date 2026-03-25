'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { TransactionButton } from '@/components/web3/TransactionButton';
import { useVaultDeposit, useVaultWithdraw, useVaultStats } from '@/hooks/useNdiddVault';
import { formatAmount } from '@/lib/utils';

export default function VaultPage() {
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const { deposit, isPending: depositPending, isSuccess: depositSuccess } = useVaultDeposit();
  const { withdraw, isPending: withdrawPending, isSuccess: withdrawSuccess } = useVaultWithdraw();
  const { totalAssets } = useVaultStats();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-white mb-8">Vault</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex gap-2 mb-6">
            {(['deposit', 'withdraw'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-primary-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <Input
            label="Amount"
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mb-4"
          />
          {tab === 'deposit' ? (
            <TransactionButton
              label="Deposit"
              isPending={depositPending}
              isSuccess={depositSuccess}
              onClick={() => amount && deposit(amount)}
              disabled={!amount}
            />
          ) : (
            <TransactionButton
              label="Withdraw"
              isPending={withdrawPending}
              isSuccess={withdrawSuccess}
              onClick={() => amount && withdraw(amount)}
              disabled={!amount}
            />
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Vault Stats">
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-zinc-400">TVL</dt>
                <dd className="text-white font-mono">
                  {totalAssets.data ? formatAmount(totalAssets.data as bigint) : '—'} NDIDD
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-400">Est. APY</dt>
                <dd className="text-green-400 font-semibold">12.5%</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
