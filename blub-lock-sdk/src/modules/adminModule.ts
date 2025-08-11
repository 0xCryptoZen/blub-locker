import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { SetPausedParams, TransferAdminParams } from '../types';
import { buildTarget } from '../utils/transaction';

export class AdminModule {
  constructor(
    private client: SuiClient,
    private packageId: string,
    private registryId: string
  ) {}

  /**
   * Pause or unpause the contract (admin only)
   * @param params Pause parameters
   * @returns Transaction that needs to be signed and executed
   */
  buildSetPausedTransaction(params: SetPausedParams): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: buildTarget(this.packageId, 'coin_locker', 'set_paused'),
      arguments: [
        tx.object(this.registryId),
        tx.pure.bool(params.pause),
      ],
    });

    return tx;
  }

  /**
   * Transfer admin rights to a new address (admin only)
   * @param params Transfer admin parameters
   * @returns Transaction that needs to be signed and executed
   */
  buildTransferAdminTransaction(params: TransferAdminParams): Transaction {
    const tx = new Transaction();

    tx.moveCall({
      target: buildTarget(this.packageId, 'coin_locker', 'transfer_admin'),
      arguments: [
        tx.object(this.registryId),
        tx.pure.address(params.newAdmin),
      ],
    });

    return tx;
  }

  /**
   * Check if an address is the current admin
   */
  async isAdmin(address: string): Promise<boolean> {
    try {
      const registryObject = await this.client.getObject({
        id: this.registryId,
        options: {
          showContent: true,
        },
      });

      if (!registryObject.data || !registryObject.data.content || 
          registryObject.data.content.dataType !== 'moveObject') {
        return false;
      }

      const fields = registryObject.data.content.fields as any;
      return fields.admin === address;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Check if the contract is currently paused
   */
  async isPaused(): Promise<boolean> {
    try {
      const registryObject = await this.client.getObject({
        id: this.registryId,
        options: {
          showContent: true,
        },
      });

      if (!registryObject.data || !registryObject.data.content || 
          registryObject.data.content.dataType !== 'moveObject') {
        return false;
      }

      const fields = registryObject.data.content.fields as any;
      return fields.paused || false;
    } catch (error) {
      console.error('Error checking pause status:', error);
      return false;
    }
  }

  /**
   * Get the current admin address
   */
  async getAdmin(): Promise<string | null> {
    try {
      const registryObject = await this.client.getObject({
        id: this.registryId,
        options: {
          showContent: true,
        },
      });

      if (!registryObject.data || !registryObject.data.content || 
          registryObject.data.content.dataType !== 'moveObject') {
        return null;
      }

      const fields = registryObject.data.content.fields as any;
      return fields.admin || null;
    } catch (error) {
      console.error('Error fetching admin address:', error);
      return null;
    }
  }
}
