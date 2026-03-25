'use client';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { TransactionButton } from '@/components/web3/TransactionButton';
import { TokenBalance } from '@/components/web3/TokenBalance';
import { useTokenTransfer } from '@/hooks/useNdiddToken';

export default function TokensPage() {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const { transfer, isPending, isSuccess } = useTokenTransfer();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-white mb-8">Token</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Your Balance">
          <TokenBalance />
        </Card>
        <Card title="Transfer Tokens">
          <div className="space-y-4">
            <Input
              label="Recipient Address"
              placeholder="0x..."
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <Input
              label="Amount"
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <TransactionButton
              label="Transfer"
              loadingLabel="Sending..."
              isPending={isPending}
              isSuccess={isSuccess}
              onClick={() => to && amount && transfer(to as `0x${string}`, amount)}
              disabled={!to || !amount}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
