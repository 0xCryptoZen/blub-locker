import { SuiClient, SuiClientOptions } from '@mysten/sui/client';
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

    // Initialize Sui client
    const clientOptions: SuiClientOptions = {};
    if (options.fullNodeUrl) {
      clientOptions.url = options.fullNodeUrl;
    } else {
      // Default URLs based on network type
      switch (options.networkType) {
        case 'mainnet':
          clientOptions.url = 'https://fullnode.mainnet.sui.io';
          break;
        case 'testnet':
          clientOptions.url = 'https://fullnode.testnet.sui.io';
          break;
        case 'devnet':
          clientOptions.url = 'https://fullnode.devnet.sui.io';
          break;
        case 'localnet':
          clientOptions.url = 'http://127.0.0.1:9000';
          break;
        default:
          clientOptions.url = 'https://fullnode.mainnet.sui.io';
      }
    }

    this.client = new SuiClient(clientOptions);

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
    options?: any
  ) {
    return await this.client.signAndExecuteTransaction({
      transaction,
      signer,
      ...options,
    });
  }

  // Dry run a transaction
  async dryRunTransaction(
    transaction: Transaction,
    sender: string
  ) {
    return await this.client.dryRunTransactionBlock({
      transactionBlock: await transaction.build({ client: this.client }),
      sender,
    });
  }
}