'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { AddressDisplay } from '@/components/web3/AddressDisplay';
import { TransactionButton } from '@/components/web3/TransactionButton';
import {
  useSmartAccount,
  useSmartWalletExecute,
  useTransferSmartWalletOwnership,
  usePaymasterInfo,
} from '@/hooks/useSmartAccount';
import { formatAmount } from '@/lib/utils';
import type { Address, Hex } from 'viem';

export default function SmartWalletPage() {
  const { isConnected } = useAccount();
  const {
    eoa,
    smartWalletAddress,
    isDeployed,
    deploy,
    deployPending,
    deploySuccess,
    deployTxHash,
    depositFormatted,
    paymasterPaused,
  } = useSmartAccount();

  const { execute, isPending: execPending, isSuccess: execSuccess } = useSmartWalletExecute(
    isDeployed ? smartWalletAddress : undefined,
  );
  const {
    transferOwnership,
    isPending: transferPending,
    isSuccess: transferSuccess,
  } = useTransferSmartWalletOwnership(isDeployed ? smartWalletAddress : undefined);
  const { deposit: paymasterDeposit } = usePaymasterInfo();

  const [execDest, setExecDest] = useState('');
  const [execValue, setExecValue] = useState('0');
  const [execData, setExecData] = useState('0x');
  const [newOwner, setNewOwner] = useState('');

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-5xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-white mb-3">Smart Wallet</h2>
          <p className="text-zinc-400 mb-6">Connect your wallet to manage your ERC-4337 smart account.</p>
          <appkit-button />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Smart Wallet</h1>
        <p className="text-zinc-400">
          ERC-4337 Account Abstraction — your smart contract wallet with gasless transaction support via paymaster.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-8">
        {/* EOA */}
        <Card title="Your EOA">
          <p className="text-xs text-zinc-500 mb-2">Externally Owned Account</p>
          {eoa && <AddressDisplay address={eoa} />}
        </Card>

        {/* Smart wallet address */}
        <Card title="Smart Wallet Address">
          <p className="text-xs text-zinc-500 mb-2">
            {isDeployed === true ? 'Deployed ✓' : isDeployed === false ? 'Not deployed yet' : 'Loading...'}
          </p>
          {smartWalletAddress && <AddressDisplay address={smartWalletAddress} />}
          {isDeployed === false && (
            <p className="text-xs text-yellow-500 mt-2">
              This is your counterfactual address — it exists even before deployment.
            </p>
          )}
        </Card>

        {/* Status */}
        <Card title="Status">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">Deployed</span>
              <Badge variant={isDeployed ? 'success' : 'neutral'}>
                {isDeployed === null ? '…' : isDeployed ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">EntryPoint Deposit</span>
              <span className="text-white font-mono text-sm">{depositFormatted ?? '0.000'} ETH</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">Paymaster</span>
              <Badge variant={paymasterPaused ? 'error' : 'success'}>
                {paymasterPaused === undefined ? '…' : paymasterPaused ? 'Paused' : 'Active'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400 text-sm">Paymaster Deposit</span>
              <span className="text-white font-mono text-sm">
                {paymasterDeposit.data !== undefined
                  ? formatAmount(paymasterDeposit.data as bigint)
                  : '—'}{' '}
                ETH
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Deploy wallet */}
        {isDeployed === false && (
          <Card title="Deploy Smart Wallet">
            <p className="text-zinc-400 text-sm mb-4">
              Deploy your smart wallet on-chain. You only need to do this once. The transaction is sent from your
              EOA.
            </p>
            <div className="bg-zinc-800 rounded-lg p-3 mb-4 text-xs font-mono text-zinc-300 break-all">
              Factory: {smartWalletAddress ?? '…'}
            </div>
            <Button
              onClick={deploy}
              isLoading={deployPending}
              disabled={deployPending || deploySuccess}
              className="w-full"
            >
              {deploySuccess ? 'Deployed! ✓' : 'Deploy Smart Wallet'}
            </Button>
            {deployTxHash && (
              <p className="text-xs text-zinc-500 mt-2 break-all">Tx: {deployTxHash}</p>
            )}
          </Card>
        )}

        {/* Execute call */}
        {isDeployed && (
          <Card title="Execute Call">
            <p className="text-zinc-400 text-sm mb-4">
              Execute an arbitrary call from your smart wallet. Must be called as the owner.
            </p>
            <div className="space-y-3">
              <Input
                label="Destination"
                placeholder="0x..."
                value={execDest}
                onChange={(e) => setExecDest(e.target.value)}
              />
              <Input
                label="Value (ETH)"
                type="number"
                placeholder="0"
                value={execValue}
                onChange={(e) => setExecValue(e.target.value)}
              />
              <Input
                label="Calldata (hex)"
                placeholder="0x"
                value={execData}
                onChange={(e) => setExecData(e.target.value)}
              />
              <TransactionButton
                label="Execute"
                isPending={execPending}
                isSuccess={execSuccess}
                disabled={!execDest}
                onClick={() =>
                  execute(
                    execDest as Address,
                    BigInt(Math.floor(parseFloat(execValue || '0') * 1e18)),
                    execData as Hex,
                  )
                }
                className="w-full"
              />
            </div>
          </Card>
        )}

        {/* Transfer ownership */}
        {isDeployed && (
          <Card title="Transfer Ownership">
            <p className="text-zinc-400 text-sm mb-4">
              Transfer your smart wallet to a new owner address.
            </p>
            <div className="space-y-3">
              <Input
                label="New Owner Address"
                placeholder="0x..."
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
              />
              <TransactionButton
                label="Transfer Ownership"
                isPending={transferPending}
                isSuccess={transferSuccess}
                disabled={!newOwner}
                onClick={() => transferOwnership(newOwner as Address)}
                variant="danger"
                className="w-full"
              />
            </div>
          </Card>
        )}

        {/* ERC-4337 Info */}
        <Card title="How It Works">
          <ul className="space-y-3 text-sm text-zinc-400">
            <li className="flex gap-2">
              <span className="text-purple-400 mt-0.5">①</span>
              <span>
                <span className="text-white">Counterfactual address</span> — your smart wallet address is
                deterministic (via CREATE2) and usable before deployment.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-purple-400 mt-0.5">②</span>
              <span>
                <span className="text-white">Account Abstraction (ERC-4337)</span> — transactions are
                UserOperations handled by bundlers, not direct EOA txs.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-purple-400 mt-0.5">③</span>
              <span>
                <span className="text-white">Paymaster</span> — the NdiddPaymaster sponsors gas for
                approved operations so users don&apos;t need ETH.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-purple-400 mt-0.5">④</span>
              <span>
                <span className="text-white">Batch execution</span> — multiple calls (approve + deposit)
                in a single UserOperation with no extra gas overhead.
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'appkit-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}
