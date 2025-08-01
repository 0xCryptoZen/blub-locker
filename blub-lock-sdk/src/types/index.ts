import { SuiObjectData } from '@mysten/sui/client';

// ===== Basic Types =====

export interface LockDetail {
  amount: string;
  lock_timestamp: string;
  unlock_timestamp: string;
}

export interface UserLockInfo {
  total_locked_amount: string;
  lock_details: { [key: string]: LockDetail };
  details_list: LockDetail[];
}

export interface LockerRegistry {
  id: string;
  total_locked: { [coinType: string]: string };
  user_locks: { [address: string]: UserLockInfo };
  paused: boolean;
  admin: string;
}

export interface CoinLock<T = any> {
  id: string;
  owner: string;
  locked_coin: {
    type: string;
    fields: {
      balance: string;
      id: { id: string };
    };
  };
  locked_amount: string;
  lock_timestamp: string;
  unlock_timestamp: string;
  claimed: boolean;
}

export interface LockCertificate {
  id: string;
  lock_id: string;
  coin_type: string;
  owner: string;
  amount: string;
  unlock_timestamp: string;
}

// ===== SDK Options =====

export interface BlubLockSDKOptions {
  packageId: string;
  registryId: string;
  networkType?: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
  fullNodeUrl?: string;
}

// ===== Transaction Types =====

export interface LockCoinsParams<T = string> {
  coinType: T;
  coins: string[];
  amount: string;
  lockDuration: number; // in seconds
  clockId?: string;
}

export interface UnlockCoinsParams<T = string> {
  coinType: T;
  lockId: string;
  clockId?: string;
}

export interface TransferCertificateParams {
  certificateId: string;
  recipient: string;
}

export interface SetPausedParams {
  paused: boolean;
}

export interface TransferAdminParams {
  newAdmin: string;
}

// ===== Query Types =====

export interface LockInfo {
  owner: string;
  lockedAmount: string;
  lockTimestamp: number;
  unlockTimestamp: number;
  claimed: boolean;
  canUnlock?: boolean;
}

export interface UserLocksInfo {
  user: string;
  locks: {
    lockId?: string;
    amount: string;
    lockTimestamp: number;
    unlockTimestamp: number;
  }[];
  totalLockedAmount: string;
}

// ===== Error Types =====

export enum BlubLockError {
  STILL_LOCKED = 0,
  NOT_OWNER = 1,
  INVALID_AMOUNT = 2,
  INVALID_DURATION = 3,
  CONTRACT_PAUSED = 4,
  ALREADY_CLAIMED = 5,
}

export const ErrorMessages: { [key in BlubLockError]: string } = {
  [BlubLockError.STILL_LOCKED]: 'Coins are still locked',
  [BlubLockError.NOT_OWNER]: 'Not the owner of this lock',
  [BlubLockError.INVALID_AMOUNT]: 'Invalid lock amount',
  [BlubLockError.INVALID_DURATION]: 'Invalid lock duration',
  [BlubLockError.CONTRACT_PAUSED]: 'Contract is paused',
  [BlubLockError.ALREADY_CLAIMED]: 'Coins already claimed',
};

// ===== Constants =====

export const MIN_LOCK_DURATION = 86400; // 1 day in seconds
export const MAX_LOCK_DURATION = 31536000; // 365 days in seconds

// ===== Helper Types =====

export type CoinTypeArg = string | { packageId: string; module: string; name: string };

export interface TransactionResult {
  digest: string;
  effects: any;
  events: any[];
  objectChanges: any[];
}