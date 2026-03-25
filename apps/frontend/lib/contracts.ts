export const TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const NFT_ADDRESS = (process.env.NEXT_PUBLIC_NFT_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_VAULT_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const GOVERNOR_ADDRESS = (process.env.NEXT_PUBLIC_GOVERNOR_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const ACCOUNT_FACTORY_ADDRESS = (process.env.NEXT_PUBLIC_ACCOUNT_FACTORY_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const PAYMASTER_ADDRESS = (process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;

export const NDIDDTOKEN_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'Transfer', type: 'event', inputs: [{ name: 'from', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }, { name: 'value', type: 'uint256', indexed: false }] },
] as const;

export const NDIDDNFT_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'mintPrice', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'publicMint', type: 'function', stateMutability: 'payable', inputs: [{ name: 'quantity', type: 'uint256' }], outputs: [] },
] as const;

export const NDIDDVAULT_ABI = [
  { name: 'totalAssets', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'totalSupply', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'deposit', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'withdraw', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'assets', type: 'uint256' }, { name: 'receiver', type: 'address' }, { name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

export const NDIDDGOVERNOR_ABI = [
  { name: 'castVote', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'proposalId', type: 'uint256' }, { name: 'support', type: 'uint8' }], outputs: [{ type: 'uint256' }] },
  { name: 'state', type: 'function', stateMutability: 'view', inputs: [{ name: 'proposalId', type: 'uint256' }], outputs: [{ type: 'uint8' }] },
  { name: 'getVotes', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }, { name: 'timepoint', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
] as const;

export const ACCOUNT_FACTORY_ABI = [
  { name: 'getAddress', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'salt', type: 'uint256' }], outputs: [{ type: 'address' }] },
  { name: 'createAccount', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'owner', type: 'address' }, { name: 'salt', type: 'uint256' }], outputs: [{ name: 'account', type: 'address' }] },
  { name: 'entryPoint', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'AccountCreated', type: 'event', inputs: [{ name: 'account', type: 'address', indexed: true }, { name: 'owner', type: 'address', indexed: true }, { name: 'salt', type: 'uint256', indexed: false }] },
] as const;

export const SMART_ACCOUNT_ABI = [
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'entryPoint', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'getDeposit', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'execute', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'dest', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }], outputs: [] },
  { name: 'executeBatch', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'dest', type: 'address[]' }, { name: 'data', type: 'bytes[]' }], outputs: [] },
  { name: 'transferOwnership', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'newOwner', type: 'address' }], outputs: [] },
] as const;

export const NDIDDPAYMASTER_ABI = [
  { name: 'getDeposit', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'minTokenBalance', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'paused', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
] as const;
