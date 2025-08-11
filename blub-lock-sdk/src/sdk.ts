import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { LockModule } from './modules/lockModule';
import { QueryModule } from './modules/queryModule';
import { AdminModule } from './modules/adminModule';
import { BlubLockSDKOptions } from './types';

export class BlubLockSDK {
  private client: SuiClient;
  private packageId: string;
  private registryId: string;
  
  public lock: LockModule;
  public query: QueryModule;
  public admin: AdminModule;

  constructor(options: BlubLockSDKOptions) {
    this.packageId = options.packageId;
    this.registryId = options.registryId;

    let fullNodeUrl: string;
    if (options.fullNodeUrl) {
      fullNodeUrl = options.fullNodeUrl;
    } else {
      // Default URLs based on network type
      switch (options.networkType) {
        case 'mainnet':
          fullNodeUrl = 'https://fullnode.mainnet.sui.io';
          break;
        case 'testnet':
          fullNodeUrl = 'https://fullnode.testnet.sui.io';
          break;
        case 'devnet':
          fullNodeUrl = 'https://fullnode.devnet.sui.io';
          break;
        case 'localnet':
          fullNodeUrl = 'http://127.0.0.1:9000';
          break;
        default:
          fullNodeUrl = 'https://fullnode.mainnet.sui.io';
      }
    }

    this.client = new SuiClient({ url: fullNodeUrl });

    // Initialize modules
    this.lock = new LockModule(this.client, this.packageId, this.registryId);
    this.query = new QueryModule(this.client, this.packageId, this.registryId);
    this.admin = new AdminModule(this.client, this.packageId, this.registryId);
  }

  // Getter methods
  getClient(): SuiClient {
    return this.client;
  }

  getPackageId(): string {
    return this.packageId;
  }

  getRegistryId(): string {
    return this.registryId;
  }

  // Create a new transaction
  createTransaction(): Transaction {
    return new Transaction();
  }

  // Execute a transaction
  async executeTransaction(
    transaction: Transaction,
    signer: any,
  ) {
    return await this.client.signAndExecuteTransaction({
      transaction,
      signer,
      options: {
        showEffects: true
      }
    });
  }

  // Dry run a transaction
  async devInspectTransaction(
    transaction: Transaction,
    sender: string
  ) {
    return await this.client.devInspectTransactionBlock({
      transactionBlock: await transaction.build({ client: this.client }),
      sender,
    });
  }
}
