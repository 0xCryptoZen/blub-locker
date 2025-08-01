import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { 
  LockInfo, 
  UserLocksInfo,
  CoinLock,
  LockerRegistry,
  LockCertificate
} from '../types';
import { 
  normalizeCoinType, 
  getDefaultClockId,
  buildTarget 
} from '../utils/transaction';
import { isUserLocksViewEvent } from '../types/events';

export class QueryModule {
  constructor(
    private client: SuiClient,
    private packageId: string,
    private registryId: string
  ) {}

  /**
   * Get detailed information about a specific lock
   */
  async getLockInfo<T = string>(
    lockId: string,
    coinType: T
  ): Promise<LockInfo | null> {
    try {
      const lockObject = await this.client.getObject({
        id: lockId,
        options: {
          showContent: true,
          showType: true,
        },
      });

      if (!lockObject.data || !lockObject.data.content || 
          lockObject.data.content.dataType !== 'moveObject') {
        return null;
      }

      const fields = lockObject.data.content.fields as any;
      const lockData: CoinLock = {
        id: lockId,
        owner: fields.owner,
        locked_coin: fields.locked_coin,
        locked_amount: fields.locked_amount,
        lock_timestamp: fields.lock_timestamp,
        unlock_timestamp: fields.unlock_timestamp,
        claimed: fields.claimed,
      };

      // Check if can unlock
      const currentTime = Math.floor(Date.now() / 1000);
      const canUnlock = currentTime >= parseInt(lockData.unlock_timestamp) && !lockData.claimed;

      return {
        owner: lockData.owner,
        lockedAmount: lockData.locked_amount,
        lockTimestamp: parseInt(lockData.lock_timestamp),
        unlockTimestamp: parseInt(lockData.unlock_timestamp),
        claimed: lockData.claimed,
        canUnlock,
      };
    } catch (error) {
      console.error('Error fetching lock info:', error);
      return null;
    }
  }

  /**
   * Check if a lock can be unlocked
   */
  async canUnlock<T = string>(
    lockId: string,
    coinType: T,
    clockId?: string
  ): Promise<boolean> {
    const lockInfo = await this.getLockInfo(lockId, coinType);
    if (!lockInfo) return false;

    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime >= lockInfo.unlockTimestamp && !lockInfo.claimed;
  }

  /**
   * Get all locks for a specific user
   */
  async getUserLocks(userAddress: string): Promise<UserLocksInfo> {
    try {
      const tx = new Transaction();
      
      // Call emit_user_locks_view to get user's lock information
      tx.moveCall({
        target: buildTarget(this.packageId, 'coin_locker', 'emit_user_locks_view'),
        arguments: [
          tx.object(this.registryId),
          tx.pure.address(userAddress),
        ],
      });

      // Simulate the transaction to get events
      const result = await this.client.devInspectTransactionBlock({
        transactionBlock: tx,
        sender: userAddress,
      });

      // Parse events to get user lock information
      const events = result.events || [];
      const userLocksEvent = events.find(isUserLocksViewEvent);

      if (!userLocksEvent || !userLocksEvent.parsedJson) {
        return {
          user: userAddress,
          locks: [],
          totalLockedAmount: '0',
        };
      }

      const eventData = userLocksEvent.parsedJson as any;
      const locks = eventData.amounts.map((amount: string, index: number) => ({
        amount,
        lockTimestamp: parseInt(eventData.lock_timestamps[index]),
        unlockTimestamp: parseInt(eventData.unlock_timestamps[index]),
      }));

      const totalLockedAmount = locks.reduce(
        (sum: bigint, lock: any) => sum + BigInt(lock.amount),
        BigInt(0)
      ).toString();

      return {
        user: userAddress,
        locks,
        totalLockedAmount,
      };
    } catch (error) {
      console.error('Error fetching user locks:', error);
      return {
        user: userAddress,
        locks: [],
        totalLockedAmount: '0',
      };
    }
  }

  /**
   * Get total locked amount for a specific coin type
   */
  async getTotalLocked(coinType: string): Promise<string> {
    try {
      const registryObject = await this.client.getObject({
        id: this.registryId,
        options: {
          showContent: true,
        },
      });

      if (!registryObject.data || !registryObject.data.content || 
          registryObject.data.content.dataType !== 'moveObject') {
        return '0';
      }

      const fields = registryObject.data.content.fields as any;
      const normalizedCoinType = normalizeCoinType(coinType);
      
      // The total_locked field is a Table, we need to check if the coin type exists
      // In a real implementation, you might need to use dynamic field queries
      const totalLocked = fields.total_locked?.fields?.[normalizedCoinType] || '0';
      
      return totalLocked;
    } catch (error) {
      console.error('Error fetching total locked:', error);
      return '0';
    }
  }

  /**
   * Get all lock certificates owned by an address
   */
  async getUserCertificates(owner: string): Promise<LockCertificate[]> {
    try {
      const objects = await this.client.getOwnedObjects({
        owner,
        filter: {
          StructType: `${this.packageId}::coin_locker::LockCertificate`,
        },
        options: {
          showContent: true,
        },
      });

      return objects.data
        .filter(obj => obj.data && obj.data.content && 
                obj.data.content.dataType === 'moveObject')
        .map(obj => {
          const fields = (obj.data!.content as any).fields;
          return {
            id: obj.data!.objectId,
            lock_id: fields.lock_id,
            coin_type: fields.coin_type,
            owner: fields.owner,
            amount: fields.amount,
            unlock_timestamp: fields.unlock_timestamp,
          };
        });
    } catch (error) {
      console.error('Error fetching user certificates:', error);
      return [];
    }
  }

  /**
   * Get registry information
   */
  async getRegistryInfo(): Promise<LockerRegistry | null> {
    try {
      const registryObject = await this.client.getObject({
        id: this.registryId,
        options: {
          showContent: true,
        },
      });

      if (!registryObject.data || !registryObject.data.content || 
          registryObject.data.content.dataType !== 'moveObject') {
        return null;
      }

      const fields = registryObject.data.content.fields as any;
      return {
        id: this.registryId,
        total_locked: fields.total_locked || {},
        user_locks: fields.user_locks || {},
        paused: fields.paused || false,
        admin: fields.admin,
      };
    } catch (error) {
      console.error('Error fetching registry info:', error);
      return null;
    }
  }
}