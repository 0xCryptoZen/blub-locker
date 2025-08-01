import { BlubLockSDK } from '../src';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

async function unlockCoinsExample() {
  // Initialize SDK
  const sdk = new BlubLockSDK({
    packageId: '0x...', // Replace with your package ID
    registryId: '0x...', // Replace with your registry ID
    networkType: 'testnet',
  });

  // Create a keypair (in production, use your wallet)
  const keypair = new Ed25519Keypair();
  const address = keypair.getPublicKey().toSuiAddress();

  try {
    // The lock ID to unlock (obtained from lock transaction)
    const lockId = '0x...'; // Replace with your lock ID
    const coinType = '0x2::sui::SUI';

    // Check if can unlock
    const canUnlock = await sdk.query.canUnlock(lockId, coinType);
    
    if (!canUnlock) {
      console.log('Cannot unlock yet - lock period not expired or already claimed');
      
      // Get lock info to see details
      const lockInfo = await sdk.query.getLockInfo(lockId, coinType);
      if (lockInfo) {
        const unlockDate = new Date(lockInfo.unlockTimestamp * 1000);
        console.log('Unlock date:', unlockDate.toLocaleString());
        console.log('Claimed:', lockInfo.claimed);
      }
      return;
    }

    // Build unlock transaction
    const tx = sdk.lock.buildUnlockCoinsTransaction({
      coinType,
      lockId,
    });

    // Execute transaction
    const result = await sdk.executeTransaction(tx, keypair);
    
    console.log('Unlock successful!');
    console.log('Transaction digest:', result.digest);
    
    // Check events for unlock details
    const unlockEvent = result.events?.find(
      event => event.type.includes('CoinUnlockedEvent')
    );
    
    if (unlockEvent && unlockEvent.parsedJson) {
      const eventData = unlockEvent.parsedJson as any;
      console.log('Unlocked amount:', eventData.amount);
      console.log('Coin type:', eventData.coin_type);
    }

  } catch (error) {
    console.error('Error unlocking coins:', error);
  }
}

// Run the example
unlockCoinsExample();