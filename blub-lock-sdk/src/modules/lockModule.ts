import { SuiClient } from '@mysten/sui/client';
import { coinWithBalance, Transaction, TransactionArgument, TransactionObjectArgument } from '@mysten/sui/transactions';
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
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils'

export class LockModule {
  constructor(
    private client: SuiClient,
    private packageId: string,
    private registryId: string
  ) {}

  /**
   * Lock coins for a specified duration
   * @param params Lock parameters
   * @returns 
   *  1. Transaction that needs to be signed and executed.
   *  2. lockCertificate.
   */
  buildLockCoinsTransaction(params: LockCoinsParams): {tx: Transaction, lockCertificate: TransactionObjectArgument} {
    const tx = new Transaction();
    
    // Validate parameters
    if (params.lockDuration < MIN_LOCK_DURATION) {
      throw new Error(`Lock duration must be at least ${MIN_LOCK_DURATION} seconds (1 day)`);
    }
    if (params.lockDuration > MAX_LOCK_DURATION) {
      throw new Error(`Lock duration must not exceed ${MAX_LOCK_DURATION} seconds (365 days)`);
    }
    if (BigInt(params.amount) <= 0) {
      throw new Error('Lock amount must be greater than 0');
    }

    const coinType = normalizeCoinType(params.coinType);
    const clockId = getDefaultClockId();

    // Build coin input
    const coinArg = coinWithBalance({balance: Number(params.amount), type: coinType})

    // Call lock_coins function
    const lockCertificate = tx.moveCall({
      target: buildTarget(this.packageId, 'coin_locker', 'lock_coins'),
      typeArguments: [coinType],
      arguments: [
        tx.object(this.registryId),
        coinArg,
        tx.pure.u64(params.lockDuration),
        tx.object(clockId),
      ],
    });

    return {
      tx,
      lockCertificate
    };
  }

  /**
   * Unlock and claim coins after lock period
   * @param params Unlock parameters
   * @returns Transaction that needs to be signed and executed
   */
  buildUnlockCoinsTransaction(params: UnlockCoinsParams): Transaction {
    const tx = new Transaction();

    const coinType = normalizeCoinType(params.coinType);

    // Call unlock_coins function
    tx.moveCall({
      target: buildTarget(this.packageId, 'coin_locker', 'unlock_coins'),
      typeArguments: [coinType],
      arguments: [
        tx.object(this.registryId),
        tx.object(params.lockId),
        tx.object(SUI_CLOCK_OBJECT_ID),
      ],
    });

    return tx;
  }
}
