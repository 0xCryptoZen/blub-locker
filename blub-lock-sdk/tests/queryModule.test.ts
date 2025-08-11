import { BlubLockSDK } from '~/index'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { setupTestSDK } from './setup'

describe('QueryModule', () => {
  let blubLockSDK: BlubLockSDK;
  let keypair: Ed25519Keypair;

  beforeEach(() => {
    const res = setupTestSDK()
    blubLockSDK = res.blubLockSDK
    keypair = res.keypair
  });

  describe('getLockInfo', () => {
    it('should return lock information', async () => {
      const lockInfo = await blubLockSDK.query.getLockInfo('0x95fa23f90877bb7b10960aea621d5b2f4e92f78ec689be530e573a5ecdc09f58', keypair.getPublicKey().toSuiAddress());
      console.log("lockInfo", JSON.stringify(lockInfo, null, 2))
    });
  });

  describe('getTotalLocked', () => {
    it('should return total locked amount for a coin type', async () => {
      const totalLocked = await blubLockSDK.query.getTotalLocked('0x2::sui::SUI');
      expect(totalLocked).toBe('1000');
    });
  });

  describe('getCertificateInfo', () => {
    it('should return user certificate information by wallet', async () => {
      const certInfo = await blubLockSDK.query.getUserCertificates('0x823e17a9a03e56f26700d8ebf23a3644bd65bfda26272d55c3e7148f77c887c1');

      console.log('certInfo', certInfo)
    });

    it('should return certificate information', async () => {
      const certInfoId = "0x99bbb6d5daf75d92fbf77e8ec9690ae26e185da0ecf9b76bf684372de0cb4934"
      const certInfo = await blubLockSDK.query.getCertificatesById([certInfoId])
      console.log('certInfo', certInfo)
    });
  });

  describe('canUnlock', () => {
    it('should return true if lock can be unlocked', async () => {
      const lockId = "0x95fa23f90877bb7b10960aea621d5b2f4e92f78ec689be530e573a5ecdc09f58"
      const canUnlock = await blubLockSDK.query.canUnlock(lockId, "0x2::sui::SUI");

      console.log("canUnlock", canUnlock)
    });
  });
})
