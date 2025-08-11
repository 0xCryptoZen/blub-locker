import { BlubLockSDK } from '~/index'
import { setupTestSDK } from './setup'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'


describe('AdminModule', () => {
  let blubLockSDK: BlubLockSDK;
  let keypair: Ed25519Keypair;

  beforeEach(() => {
    const res = setupTestSDK()
    blubLockSDK = res.blubLockSDK
    keypair = res.keypair
  });

  describe('Admin', () => {
    it('is admin A', async () => {
      const isAdmin = await blubLockSDK.admin.isAdmin('0x823e17a9a03e56f26700d8ebf23a3644bd65bfda26272d55c3e7148f77c887c1')
      expect(isAdmin).toBe(true)
    })

    it('is admin B', async () => {
      const isAdmin = await blubLockSDK.admin.isAdmin('0xaedd3628fb73e2ff7872731966417d199299b631ab0b7ddc42b4eb9ed31c063c')
      expect(isAdmin).toBe(true)
    })

    it('set new admin', async () => {
      const newAdmin = "0xaedd3628fb73e2ff7872731966417d199299b631ab0b7ddc42b4eb9ed31c063c"
      const tx = await blubLockSDK.admin.buildTransferAdminTransaction({newAdmin})
      const res = await blubLockSDK.executeTransaction(tx, keypair)
      console.log('res', JSON.stringify(res, null, 2))
    })

    it('is pause', async () => {
      const isPause = await blubLockSDK.admin.isPaused()
      console.log("isPause", isPause)
    })

    it('set pause', async () => {
      const pause = false
      const txb = await blubLockSDK.admin.buildSetPausedTransaction({pause})
      const res = await blubLockSDK.executeTransaction(txb, keypair)
      console.log('res', JSON.stringify(res, null, 2))
    })
  })
});
