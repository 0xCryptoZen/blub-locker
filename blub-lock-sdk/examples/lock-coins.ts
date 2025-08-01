import { BlubLockSDK } from '../src';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

async function lockCoinsExample() {
  // Initialize SDK
  const sdk = new BlubLockSDK({
    packageId: '0x3e49d84a9091adde8883c2f60d4e89a9e3b8b0147aab6e1216ed81c01a6a5a17', // Replace with your package ID
    registryId: '0x8d9c09357e5e2528f5768865a06b276511e24135913bbf7145a6a1625865c391', // Replace with your registry ID
    networkType: 'testnet',
  });

  // Create a keypair (in production, use your wallet)
  const keypair = new Ed25519Keypair();
  const address = keypair.getPublicKey().toSuiAddress();

  try {
    // Define the coin type (e.g., SUI)
    const coinType = '0x2::sui::SUI';
    
    // Get user's coins
    const coins = await sdk.lock.getCoinsForAddress(address, coinType);
    
    if (coins.length === 0) {
      console.log('No coins found for locking');
      return;
    }

    // Lock parameters
    const lockAmount = '1000000000'; // 1 SUI (9 decimals)
    const lockDuration = 7 * 24 * 60 * 60; // 7 days in seconds

    // Build lock transaction
    const tx = sdk.lock.buildLockCoinsTransaction({
      coinType,
      coins: coins.slice(0, 2), // Use first 2 coins
      amount: lockAmount,
      lockDuration,
    });

    // Execute transaction
    const result = await sdk.executeTransaction(tx, keypair);
    
    console.log('Lock successful!');
    console.log('Transaction digest:', result.digest);
    
    // Find the created certificate from object changes
    const createdObjects = result.objectChanges?.filter(
      change => change.type === 'created'
    ) || [];
    
    const certificate = createdObjects.find(obj => 
      obj.objectType.includes('LockCertificate')
    );
    
    if (certificate) {
      console.log('Certificate ID:', certificate.objectId);
    }

  } catch (error) {
    console.error('Error locking coins:', error);
  }
}

// Run the example
lockCoinsExample();
