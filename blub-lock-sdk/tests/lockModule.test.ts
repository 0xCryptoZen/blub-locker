import { LockModule } from '../src/modules/lockModule';
import { coinWithBalance, Transaction } from '@mysten/sui/transactions';
import { 
  LockCoinsParams, 
  UnlockCoinsParams, 
  MIN_LOCK_DURATION,
  MAX_LOCK_DURATION
} from '../src/types';
import { BlubLockSDK } from '~/index'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { setupTestSDK, TESTCOIN } from './setup'

describe('LockModule', () => {
  let blubLockSDK: BlubLockSDK;
  let keypair: Ed25519Keypair;

  beforeEach(() => {
    const res = setupTestSDK()
    blubLockSDK = res.blubLockSDK
    keypair = res.keypair
  });

  describe('buildLockCoinsTransaction', () => {
    it('should create a valid lock transaction', async () => {
      const params: LockCoinsParams = {
        coinType: TESTCOIN,
        amount: '1000',
        lockDuration: MIN_LOCK_DURATION,
      };

      const {tx, lockCertificate} = blubLockSDK.lock.buildLockCoinsTransaction(params);
      tx.transferObjects([lockCertificate], keypair.toSuiAddress())

      const res = await blubLockSDK.executeTransaction(tx, keypair)
      console.log('res', JSON.stringify(res, null, 2))
    });

    it('should throw error for lock duration too short', () => {
      const params: LockCoinsParams = {
        coinType: '0x2::sui::SUI',
        amount: '1000',
        lockDuration: MIN_LOCK_DURATION - 1,
      };

      expect(() => blubLockSDK.lock.buildLockCoinsTransaction(params))
        .toThrow(`Lock duration must be at least ${MIN_LOCK_DURATION} seconds (1 day)`);
    });

    it('should throw error for lock duration too long', () => {
      const params: LockCoinsParams = {
        coinType: '0x2::sui::SUI',
        amount: '1000',
        lockDuration: MAX_LOCK_DURATION + 1,
      };

      expect(() => blubLockSDK.lock.buildLockCoinsTransaction(params))
        .toThrow(`Lock duration must not exceed ${MAX_LOCK_DURATION} seconds (365 days)`);
    });

    it('should throw error for zero amount', () => {
      const params: LockCoinsParams = {
        coinType: '0x2::sui::SUI',
        amount: '0',
        lockDuration: MIN_LOCK_DURATION + 1,
      };

      expect(() => blubLockSDK.lock.buildLockCoinsTransaction(params))
        .toThrow('Lock amount must be greater than 0');
    });
  });

  describe('buildUnlockCoinsTransaction', () => {
    it('should create a valid unlock transaction', () => {
      const params: UnlockCoinsParams = {
        coinType: TESTCOIN,
        lockId: '0x99bbb6d5daf75d92fbf77e8ec9690ae26e185da0ecf9b76bf684372de0cb4934',
      };

      const tx = blubLockSDK.lock.buildUnlockCoinsTransaction(params);
      expect(tx).toBeInstanceOf(Transaction);
    });

    it('should use custom clock ID if provided', () => {
      const customClockId = '0x789';
      const params: UnlockCoinsParams = {
        coinType: '0x2::sui::SUI',
        lockId: '0xlock123',
        clockId: customClockId,
      };

      const tx = blubLockSDK.lock.buildUnlockCoinsTransaction(params);
      expect(tx).toBeInstanceOf(Transaction);
    });
  });
});
