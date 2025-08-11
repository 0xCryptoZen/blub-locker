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
  buildTarget 
} from '../utils/transaction';
import { isUserLocksViewEvent } from '../types/events';
import { completionCoin, getObjectFields } from '~/utils/sui'

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
        lock_ts: fields.lock_ts,
        unlock_ts: fields.unlock_ts,
        claimed: fields.claimed,
      };

      // Check if can unlock
      const currentTime = Math.floor(Date.now() / 1000);
      const canUnlock = currentTime >= parseInt(lockData.unlock_ts) && !lockData.claimed;

      return {
        owner: lockData.owner,
        lockedAmount: lockData.locked_amount,
        lockTimestamp: parseInt(lockData.lock_ts),
        unlockTimestamp: parseInt(lockData.unlock_ts),
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
        lockTimestamp: parseInt(eventData.lock_tss[index]),
        unlockTimestamp: parseInt(eventData.unlock_tss[index]),
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

      const normalizedCoinType = completionCoin(coinType);
      
      // The total_locked field is a Table, we need to check if the coin type exists
      // In a real implementation, you might need to use dynamic field queries

      const totalLockedID = fields.total_locked?.fields?.id?.id

      let noExit = true 
      const limit = 50
      let cursor = null
      let totalLockedMap: Map<string, bigint> = new Map()
      
      while (noExit) {
        const totalLockedFields = await this.client.getDynamicFields({parentId: totalLockedID, limit, cursor})
        
        // 获取所有的 objectId
        const allFieldIDs = totalLockedFields.data.map(item => item.objectId)
        
        if (allFieldIDs.length === 0) {
          break
        }
        
        const allFieldObjects = await this.client.multiGetObjects({ids: allFieldIDs, options: {showContent: true}})

        for (const item of allFieldObjects) {
          try {
            const fields = getObjectFields(item)
            if (!fields) {
              continue
            }

            
            // 检查必要的字段是否存在
            if (!fields?.name?.fields?.name || !fields?.value) {
              continue
            }
            
            const coinTypeName = fields.name.fields.name
            const coinType = completionCoin("0x" + coinTypeName)
            const amount = BigInt(fields.value)
            
            // 设置到 Map 中
            totalLockedMap.set(coinType, amount)
            
          } catch (error) {
            continue
          }
        }
        
        // 检查是否还有更多数据
        if (totalLockedFields.hasNextPage && totalLockedFields.nextCursor) {
          cursor = totalLockedFields.nextCursor
        } else {
          noExit = false
        }
      }
      const totalLocked = totalLockedMap.get(normalizedCoinType)?.toString() || '0';
      return totalLocked;
    } catch (error) {
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
            coin_type: completionCoin(fields.coin_type.fields.name),
            owner: fields.owner,
            amount: fields.amount,
            unlock_ts: fields.unlock_ts,
          };
        });
    } catch (error) {
      console.error('Error fetching user certificates:', error);
      return [];
    }
  }

  async getCertificatesById(certificateIDs: string[]): Promise<LockCertificate[]> {
    try {
      const objects = await this.client.multiGetObjects({
        ids: certificateIDs,
        options: {
          showContent: true,
        },
      });

      return objects
        .filter(obj => obj.data && obj.data.content && 
                obj.data.content.dataType === 'moveObject')
        .map(obj => {
          const fields = (obj.data!.content as any).fields;
          return {
            id: obj.data!.objectId,
            lock_id: fields.lock_id,
            coin_type: completionCoin(fields.coin_type.fields.name),
            owner: fields.owner,
            amount: fields.amount,
            unlock_ts: fields.unlock_ts,
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
