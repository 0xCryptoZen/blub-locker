import { BlubLockSDK } from '../src';

async function queryLocksExample() {
  // Initialize SDK
  const sdk = new BlubLockSDK({
    packageId: '0x3e49d84a9091adde8883c2f60d4e89a9e3b8b0147aab6e1216ed81c01a6a5a17', // Replace with your package ID
    registryId: '0x8d9c09357e5e2528f5768865a06b276511e24135913bbf7145a6a1625865c391', // Replace with your registry ID
    networkType: 'testnet',
  });

  const userAddress = '0x...'; // Replace with user address to query

  try {
    // 1. Query user's all locks
    console.log('=== User Locks ===');
    const userLocks = await sdk.query.getUserLocks(userAddress);
    
    console.log(`User: ${userLocks.user}`);
    console.log(`Total locked amount: ${userLocks.totalLockedAmount}`);
    console.log(`Number of locks: ${userLocks.locks.length}`);
    
    userLocks.locks.forEach((lock, index) => {
      const lockDate = new Date(lock.lockTimestamp * 1000);
      const unlockDate = new Date(lock.unlockTimestamp * 1000);
      
      console.log(`\nLock #${index + 1}:`);
      console.log(`  Amount: ${lock.amount}`);
      console.log(`  Locked at: ${lockDate.toLocaleString()}`);
      console.log(`  Unlocks at: ${unlockDate.toLocaleString()}`);
    });

    // 2. Query user's certificates
    console.log('\n=== User Certificates ===');
    const certificates = await sdk.query.getUserCertificates(userAddress);
    
    console.log(`Number of certificates: ${certificates.length}`);
    certificates.forEach((cert, index) => {
      const unlockDate = new Date(parseInt(cert.unlock_ts) * 1000);
      
      console.log(`\nCertificate #${index + 1}:`);
      console.log(`  ID: ${cert.id}`);
      console.log(`  Lock ID: ${cert.lock_id}`);
      console.log(`  Coin Type: ${cert.coin_type}`);
      console.log(`  Amount: ${cert.amount}`);
      console.log(`  Unlocks at: ${unlockDate.toLocaleString()}`);
    });

    // 3. Query specific lock info
    if (certificates.length > 0) {
      const lockId = certificates[0]!.lock_id;
      const coinType = certificates[0]!.coin_type;
      
      console.log('\n=== Specific Lock Info ===');
      const lockInfo = await sdk.query.getLockInfo(lockId, coinType);
      
      if (lockInfo) {
        console.log(`Lock ID: ${lockId}`);
        console.log(`Owner: ${lockInfo.owner}`);
        console.log(`Amount: ${lockInfo.lockedAmount}`);
        console.log(`Can unlock: ${lockInfo.canUnlock}`);
        console.log(`Claimed: ${lockInfo.claimed}`);
      }
    }

    // 4. Query total locked for a coin type
    console.log('\n=== Total Locked ===');
    const coinType = '0x2::sui::SUI';
    const totalLocked = await sdk.query.getTotalLocked(coinType);
    console.log(`Total ${coinType} locked: ${totalLocked}`);

    // 5. Query registry info
    console.log('\n=== Registry Info ===');
    const registryInfo = await sdk.query.getRegistryInfo();
    
    if (registryInfo) {
      console.log(`Registry ID: ${registryInfo.id}`);
      console.log(`Paused: ${registryInfo.paused}`);
      console.log(`Admin: ${registryInfo.admin}`);
    }

  } catch (error) {
    console.error('Error querying locks:', error);
  }
}

// Run the example
queryLocksExample();
