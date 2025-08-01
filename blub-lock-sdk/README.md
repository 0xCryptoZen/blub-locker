# Blub Lock SDK

A TypeScript SDK for interacting with the Blub Lock smart contract on Sui blockchain. This SDK provides a convenient interface for locking coins, managing locks, and querying lock information.

## Features

- 🔒 **Lock coins** for a specified duration (1-365 days)
- 🔓 **Unlock coins** after the lock period expires
- 📜 **Transfer lock certificates** to other addresses
- 🔍 **Query lock information** and user balances
- 👮 **Admin functions** for contract management
- 🎯 **Full TypeScript support** with comprehensive type definitions

## Installation

```bash
npm install blub-lock-sdk
# or
yarn add blub-lock-sdk
```

## Quick Start

```typescript
import { BlubLockSDK } from 'blub-lock-sdk';

// Initialize the SDK
const sdk = new BlubLockSDK({
  packageId: '0x...', // Your deployed package ID
  registryId: '0x...', // Your registry object ID
  networkType: 'mainnet', // or 'testnet', 'devnet', 'localnet'
});

// Lock coins
const tx = sdk.lock.buildLockCoinsTransaction({
  coinType: '0x2::sui::SUI',
  coins: ['0x...'], // Your coin object IDs
  amount: '1000000000', // 1 SUI (9 decimals)
  lockDuration: 86400 * 7, // 7 days
});

// Execute the transaction with your signer
const result = await sdk.executeTransaction(tx, signer);
```

## Core Modules

### Lock Module

Handles locking and unlocking operations:

```typescript
// Lock coins
const lockTx = sdk.lock.buildLockCoinsTransaction({
  coinType: '0x2::sui::SUI',
  coins: ['0xcoin1', '0xcoin2'],
  amount: '5000000000', // 5 SUI
  lockDuration: 86400 * 30, // 30 days
});

// Unlock coins
const unlockTx = sdk.lock.buildUnlockCoinsTransaction({
  coinType: '0x2::sui::SUI',
  lockId: '0xlockid',
});

// Transfer certificate
const transferTx = sdk.lock.buildTransferCertificateTransaction({
  certificateId: '0xcertid',
  recipient: '0xrecipient',
});
```

### Query Module

Query lock information and states:

```typescript
// Get lock information
const lockInfo = await sdk.query.getLockInfo(lockId, coinType);

// Check if can unlock
const canUnlock = await sdk.query.canUnlock(lockId, coinType);

// Get user's all locks
const userLocks = await sdk.query.getUserLocks(userAddress);

// Get user's certificates
const certificates = await sdk.query.getUserCertificates(userAddress);

// Get total locked amount for a coin type
const totalLocked = await sdk.query.getTotalLocked(coinType);
```

### Admin Module

Admin-only functions:

```typescript
// Pause/unpause contract
const pauseTx = sdk.admin.buildSetPausedTransaction({ paused: true });

// Transfer admin rights
const transferAdminTx = sdk.admin.buildTransferAdminTransaction({
  newAdmin: '0xnewadmin',
});

// Check admin status
const isAdmin = await sdk.admin.isAdmin(address);
const isPaused = await sdk.admin.isPaused();
```

## Type Definitions

The SDK provides comprehensive TypeScript types:

```typescript
interface LockCoinsParams {
  coinType: string;
  coins: string[];
  amount: string;
  lockDuration: number; // seconds
  clockId?: string;
}

interface LockInfo {
  owner: string;
  lockedAmount: string;
  lockTimestamp: number;
  unlockTimestamp: number;
  claimed: boolean;
  canUnlock?: boolean;
}

interface UserLocksInfo {
  user: string;
  locks: Array<{
    amount: string;
    lockTimestamp: number;
    unlockTimestamp: number;
  }>;
  totalLockedAmount: string;
}
```

## Error Handling

The SDK includes error enums and messages:

```typescript
import { BlubLockError, ErrorMessages } from 'blub-lock-sdk';

try {
  // ... your code
} catch (error) {
  if (error.code === BlubLockError.STILL_LOCKED) {
    console.log(ErrorMessages[BlubLockError.STILL_LOCKED]);
  }
}
```

## Examples

Check the `examples/` directory for complete examples:

- `lock-coins.ts` - How to lock coins
- `unlock-coins.ts` - How to unlock coins
- `query-locks.ts` - How to query lock information

## Constants

- Minimum lock duration: 86,400 seconds (1 day)
- Maximum lock duration: 31,536,000 seconds (365 days)

## Development

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## License

MIT