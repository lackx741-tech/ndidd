'use client';

import { useState, useCallback } from 'react';
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
  useSmartWalletBatchExecute,
  useTransferSmartWalletOwnership,
  usePaymasterInfo,
} from '@/hooks/useSmartAccount';
import { formatAmount } from '@/lib/utils';
import type { Address, Hex } from 'viem';

interface BatchCall {
  dest: string;
  data: string;
}

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
  const { executeBatch, isPending: batchPending, isSuccess: batchSuccess } =
    useSmartWalletBatchExecute(isDeployed ? smartWalletAddress : undefined);
  const {
    transferOwnership,
    isPending: transferPending,
    isSuccess: transferSuccess,
  } = useTransferSmartWalletOwnership(isDeployed ? smartWalletAddress : undefined);
  const { deposit: paymasterDeposit } = usePaymasterInfo();

  // Single execute state
  const [execDest, setExecDest] = useState('');
  const [execValue, setExecValue] = useState('0');
  const [execData, setExecData] = useState('0x');
  const [newOwner, setNewOwner] = useState('');

  // Batch execute state
  const [batchCalls, setBatchCalls] = useState<BatchCall[]>([
    { dest: '', data: '0x' },
    { dest: '', data: '0x' },
  ]);
  const updateBatchCall = useCallback((index: number, field: keyof BatchCall, value: string) => {
    setBatchCalls((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  }, []);
  const addBatchCall = useCallback(() => setBatchCalls((prev) => [...prev, { dest: '', data: '0x' }]), []);
  const removeBatchCall = useCallback(
    (index: number) => setBatchCalls((prev) => prev.filter((_, i) => i !== index)),
    [],
  );

  // UserOp runner state
  const [bundlerUrl, setBundlerUrl] = useState('');
  const [userOpJson, setUserOpJson] = useState('');
  const [entryPointAddr, setEntryPointAddr] = useState('');
  const [userOpResult, setUserOpResult] = useState<string | null>(null);
  const [userOpError, setUserOpError] = useState<string | null>(null);
  const [userOpPending, setUserOpPending] = useState(false);

  const handleSendUserOp = useCallback(async () => {
    setUserOpResult(null);
    setUserOpError(null);
    setUserOpPending(true);
    try {
      const userOp = JSON.parse(userOpJson);
      const body = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_sendUserOperation',
        params: [userOp, entryPointAddr],
      });
      const res = await fetch(bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const json = await res.json() as { result?: string; error?: { message: string } };
      if (json.error) throw new Error(json.error.message);
      setUserOpResult(json.result ?? 'ok');
    } catch (e) {
      setUserOpError(e instanceof Error ? e.message : String(e));
    } finally {
      setUserOpPending(false);
    }
  }, [bundlerUrl, userOpJson, entryPointAddr]);

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

        {/* Execute single call */}
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

        {/* Batch execute */}
        {isDeployed && (
          <Card title="Batch Execute">
            <p className="text-zinc-400 text-sm mb-4">
              Execute multiple calls atomically in a single transaction from your smart wallet.
            </p>
            <div className="space-y-4">
              {batchCalls.map((call, i) => (
                <div key={i} className="rounded-lg border border-zinc-700 p-3 space-y-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-zinc-400 text-xs font-medium">Call #{i + 1}</span>
                    {batchCalls.length > 1 && (
                      <button
                        onClick={() => removeBatchCall(i)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <Input
                    label="Destination"
                    placeholder="0x..."
                    value={call.dest}
                    onChange={(e) => updateBatchCall(i, 'dest', e.target.value)}
                  />
                  <Input
                    label="Calldata (hex)"
                    placeholder="0x"
                    value={call.data}
                    onChange={(e) => updateBatchCall(i, 'data', e.target.value)}
                  />
                </div>
              ))}
              <Button onClick={addBatchCall} variant="secondary" className="w-full text-sm">
                + Add Call
              </Button>
              <TransactionButton
                label="Execute Batch"
                isPending={batchPending}
                isSuccess={batchSuccess}
                disabled={batchCalls.every((c) => !c.dest)}
                onClick={() => {
                  const validCalls = batchCalls.filter((c) => c.dest);
                  executeBatch(
                    validCalls.map((c) => c.dest as Address),
                    validCalls.map((c) => (c.data || '0x') as Hex),
                  );
                }}
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
                className="w-full"
              />
            </div>
          </Card>
        )}

        {/* UserOperation Runner */}
        <Card title="Run UserOperation">
          <p className="text-zinc-400 text-sm mb-4">
            Submit a signed UserOperation directly to an ERC-4337 bundler (e.g. Alchemy, Pimlico).
          </p>
          <div className="space-y-3">
            <Input
              label="Bundler URL"
              placeholder="https://api.pimlico.io/v1/..."
              value={bundlerUrl}
              onChange={(e) => setBundlerUrl(e.target.value)}
            />
            <Input
              label="EntryPoint Address"
              placeholder="0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
              value={entryPointAddr}
              onChange={(e) => setEntryPointAddr(e.target.value)}
            />
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">UserOperation JSON</label>
              <textarea
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-200 text-xs font-mono p-3 h-36 resize-y focus:outline-none focus:ring-1 focus:ring-purple-500"
                placeholder='{"sender":"0x...","nonce":"0x0","initCode":"0x",...}'
                value={userOpJson}
                onChange={(e) => setUserOpJson(e.target.value)}
              />
            </div>
            <Button
              onClick={handleSendUserOp}
              isLoading={userOpPending}
              disabled={userOpPending || !bundlerUrl || !userOpJson || !entryPointAddr}
              className="w-full"
            >
              Send UserOperation
            </Button>
            {userOpResult && (
              <div className="rounded-lg bg-green-950 border border-green-800 p-3 text-xs text-green-300 break-all">
                ✓ UserOp Hash: {userOpResult}
              </div>
            )}
            {userOpError && (
              <div className="rounded-lg bg-red-950 border border-red-800 p-3 text-xs text-red-300 break-all">
                ✗ Error: {userOpError}
              </div>
            )}
          </div>
        </Card>

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

