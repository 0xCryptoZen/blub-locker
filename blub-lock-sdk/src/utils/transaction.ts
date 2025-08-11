import { Transaction, TransactionArgument } from '@mysten/sui/transactions';
import { CoinTypeArg } from '../types';

export function normalizeCoinType(coinType: CoinTypeArg): string {
  if (typeof coinType === 'string') {
    return coinType;
  }
  return `${coinType.packageId}::${coinType.module}::${coinType.name}`;
}

export function buildCoinVector(
  tx: Transaction,
  coinType: string,
  coins: string[],
  amount: string
): TransactionArgument {
  if (coins.length === 0) {
    throw new Error('No coins provided');
  }

  // If only one coin and it might have enough balance, use it directly
  if (coins.length === 1) {
    const [coin] = tx.splitCoins(tx.object(coins[0]!), [tx.pure.u64(amount)]);
    return coin;
  }

  // Multiple coins: merge them first, then split the required amount
  const primaryCoin = tx.object(coins[0]!);
  const otherCoins = coins.slice(1).map(id => tx.object(id));
  
  if (otherCoins.length > 0) {
    tx.mergeCoins(primaryCoin, otherCoins);
  }

  const [splitCoin] = tx.splitCoins(primaryCoin, [tx.pure.u64(amount)]);
  return splitCoin;
}

export function getDefaultClockId(): string {
  return '0x6';
}

export function buildTarget(packageId: string, module: string, functionName: string): string {
  return `${packageId}::${module}::${functionName}`;
}
