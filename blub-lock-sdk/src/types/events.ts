// ===== Event Types =====

export interface CoinLockedEvent {
  lock_id: string;
  owner: string;
  coin_type: string;
  amount: string;
  lock_timestamp: string;
  unlock_timestamp: string;
}

export interface CoinUnlockedEvent {
  lock_id: string;
  owner: string;
  coin_type: string;
  amount: string;
  unlock_timestamp: string;
}

export interface UserLocksViewEvent {
  user: string;
  lock_ids: string[];
  amounts: string[];
  lock_timestamps: string[];
  unlock_timestamps: string[];
}

export type BlubLockEvent = CoinLockedEvent | CoinUnlockedEvent | UserLocksViewEvent;

export function isCoinLockedEvent(event: any): event is CoinLockedEvent {
  return event.type?.includes('CoinLockedEvent');
}

export function isCoinUnlockedEvent(event: any): event is CoinUnlockedEvent {
  return event.type?.includes('CoinUnlockedEvent');
}

export function isUserLocksViewEvent(event: any): event is UserLocksViewEvent {
  return event.type?.includes('UserLocksViewEvent');
}