import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { 
  LockCoinsParams, 
  UnlockCoinsParams, 
  TransferCertificateParams,
  MIN_LOCK_DURATION,
  MAX_LOCK_DURATION
} from '../types';
import { 
  normalizeCoinType, 
  buildCoinVector, 
  getDefaultClockId,
  buildTarget 
} from '../utils/transaction';

export class LockModule {
  constructor(
    private client: SuiClient,
    private packageId: string,
    private registryId: string
  ) {}

  /**
   * Lock coins for a specified duration
   * @param params Lock parameters
   * @returns Transaction that needs to be signed and executed
   */
  buildLockCoinsTransaction<T = string>(params: LockCoinsParams<T>): Transaction {
    const tx = new Transaction();
    
    // Validate parameters
    if (params.lockDuration < MIN_LOCK_DURATION) {
      throw new Error(`Lock duration must be at least ${MIN_LOCK_DURATION} seconds (1 day)`);
    }
    if (params.lockDuration > MAX_LOCK_DURATION) {
      throw new Error(`Lock duration must not exceed ${MAX_LOCK_DURATION} seconds (365 days)`);
    }
    if (!params.coins || params.coins.length === 0) {
      throw new Error('No coins provided for locking');
    }
    if (BigInt(params.amount) <= 0) {
      throw new Error('Lock amount must be greater than 0');
    }

    const coinType = normalizeCoinType(params.coinType);
    const clockId = params.clockId || getDefaultClockId();

    // Build coin input
    const coinArg = buildCoinVector(tx, coinType, params.coins, params.amount);

    // Call lock_coins function
    const result = tx.moveCall({
      target: buildTarget(this.packageId, 'coin_locker', 'lock_coins'),
      typeArguments: [coinType],
      arguments: [
        tx.object(this.registryId),
        coinArg,
        tx.pure.u64(params.lockDuration),
        tx.object(clockId),
      ],
    });

    // Transfer the certificate to the sender
    tx.transferObjects([result], tx.pure.address(tx.pure.address('0x0')));

    return tx;
  }

  /**
   * Unlock and claim coins after lock period
   * @param params Unlock parameters
   * @returns Transaction that needs to be signed and executed
   */
  buildUnlockCoinsTransaction<T = string>(params: UnlockCoinsParams<T>): Transaction {
    const tx = new Transaction();

    const coinType = normalizeCoinType(params.coinType);
    const clockId = params.clockId || getDefaultClockId();

    // Call unlock_coins function
    tx.moveCall({
      target: buildTarget(this.packageId, 'coin_locker', 'unlock_coins'),
      typeArguments: [coinType],
      arguments: [
        tx.object(this.registryId),
        tx.object(params.lockId),
        tx.object(clockId),
      ],
    });

    return tx;
  }

  /**
   * Transfer lock certificate to another address
   * @param params Transfer parameters
   * @returns Transaction that needs to be signed and executed
   */
  buildTransferCertificateTransaction(params: TransferCertificateParams): Transaction {
    const tx = new Transaction();

    // Call transfer_certificate function
    tx.moveCall({
      target: buildTarget(this.packageId, 'coin_locker', 'transfer_certificate'),
      arguments: [
        tx.object(params.certificateId),
        tx.pure.address(params.recipient),
      ],
    });

    return tx;
  }

  /**
   * Helper: Get all coins of a specific type for an address
   */
  async getCoinsForAddress(
    owner: string,
    coinType: string,
    limit = 50
  ): Promise<string[]> {
    const coins = await this.client.getCoins({
      owner,
      coinType: normalizeCoinType(coinType),
      limit,
    });

    return coins.data
      .filter(coin => BigInt(coin.balance) > 0)
      .map(coin => coin.coinObjectId);
  }

  /**
   * Helper: Get the total balance of coins
   */
  async getTotalBalance(
    owner: string,
    coinType: string
  ): Promise<bigint> {
    const balance = await this.client.getBalance({
      owner,
      coinType: normalizeCoinType(coinType),
    });

    return BigInt(balance.totalBalance);
  }
}