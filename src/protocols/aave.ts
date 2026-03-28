/**
 * Aave Protocol Adapter
 * 
 * Handles interaction with Aave V3 lending pools across supported chains:
 * - Supply assets to earn interest
 * - Borrow assets against collateral
 * - Withdraw supplied assets
 * - Repay borrowed assets
 */

import type { Chain, AaveMarket, AavePosition, TransactionRequest, TransactionResult } from '../types/index.js';
import { WDKWallet } from '../wdk/wallet.js';

// Aave V3 Pool addresses by chain
const AAVE_POOL_ADDRESSES: Record<Chain, string> = {
  ethereum: '0x87870Bca3F3f6335e32cdC0C60F7D9c5aD5b29a8',
  polygon: '0x7705f3A6371498A57b7D06aC19E89d1A76D0b8d4',
  arbitrum: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
  base: '0xA238Dd80C259a72e81D7e4664aD40387F32c1cc',
};

// Aave aToken addresses (simplified - would need full mapping for production)
const ATOKEN_ABI = [
  'function underlyingAssetAddress() view returns (address)',
  'function balanceOf(address user) view returns (uint256)',
];

const POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
  'function withdraw(address asset, uint256 amount, address to) returns (uint256)',
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
  'function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) returns (uint256)',
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
];

/**
 * Aave Adapter class for interacting with Aave V3 pools
 */
export class AaveAdapter {
  private wallet: WDKWallet;
  
  constructor(wallet: WDKWallet) {
    this.wallet = wallet;
  }

  /**
   * Get the pool address for a given chain
   */
  private getPoolAddress(chain: Chain): string {
    const address = AAVE_POOL_ADDRESSES[chain];
    if (!address) {
      throw new Error(`Aave not available on chain: ${chain}`);
    }
    return address;
  }

  /**
   * Get Aave markets data for a chain (via TinyFish web scraping)
   * This would be called via the strategy engine to get real-time market data
   */
  async getMarkets(chain: Chain): Promise<AaveMarket[]> {
    // This would be handled by the strategy engine scanning app.aave.com
    // Returns market data including supply/borrow rates, liquidity
    console.log(`[Aave] Getting markets for ${chain}`);
    return [];
  }

  /**
   * Supply an asset to Aave pool
   */
  async supply(
    chain: Chain,
    assetAddress: string,
    amount: string
  ): Promise<TransactionResult> {
    const poolAddress = this.getPoolAddress(chain);
    const userAddress = this.wallet.getAddress();
    if (!userAddress) {
      throw new Error('Wallet not initialized');
    }
    
    console.log(`[Aave] Supplying ${amount} of ${assetAddress} on ${chain}`);
    
    const tx: TransactionRequest = {
      chain,
      to: poolAddress,
      data: this.encodeSupply(assetAddress, amount, userAddress),
      gas_limit: '200000',
    };
    
    const result = await this.wallet.sendTransaction(tx);
    return this.parseTransactionResult(result, chain);
  }

  /**
   * Withdraw an asset from Aave pool
   */
  async withdraw(
    chain: Chain,
    assetAddress: string,
    amount: string,
    recipient?: string
  ): Promise<TransactionResult> {
    const poolAddress = this.getPoolAddress(chain);
    const walletAddress = this.wallet.getAddress();
    if (!walletAddress) {
      throw new Error('Wallet not initialized');
    }
    const recipientAddress = recipient || walletAddress;
    
    console.log(`[Aave] Withdrawing ${amount} of ${assetAddress} on ${chain}`);
    
    const tx: TransactionRequest = {
      chain,
      to: poolAddress,
      data: this.encodeWithdraw(assetAddress, amount, recipientAddress),
      gas_limit: '200000',
    };
    
    const result = await this.wallet.sendTransaction(tx);
    return this.parseTransactionResult(result, chain);
  }

  /**
   * Borrow an asset from Aave pool
   */
  async borrow(
    chain: Chain,
    assetAddress: string,
    amount: string,
    interestRateMode: 'stable' | 'variable' = 'variable'
  ): Promise<TransactionResult> {
    const poolAddress = this.getPoolAddress(chain);
    const userAddress = this.wallet.getAddress();
    if (!userAddress) {
      throw new Error('Wallet not initialized');
    }
    
    console.log(`[Aave] Borrowing ${amount} of ${assetAddress} on ${chain}`);
    
    const tx: TransactionRequest = {
      chain,
      to: poolAddress,
      data: this.encodeBorrow(assetAddress, amount, interestRateMode, userAddress),
      gas_limit: '300000',
    };
    
    const result = await this.wallet.sendTransaction(tx);
    return this.parseTransactionResult(result, chain);
  }

  /**
   * Repay borrowed asset
   */
  async repay(
    chain: Chain,
    assetAddress: string,
    amount: string,
    interestRateMode: 'stable' | 'variable' = 'variable'
  ): Promise<TransactionResult> {
    const poolAddress = this.getPoolAddress(chain);
    const userAddress = this.wallet.getAddress();
    if (!userAddress) {
      throw new Error('Wallet not initialized');
    }
    
    console.log(`[Aave] Repaying ${amount} of ${assetAddress} on ${chain}`);
    
    const tx: TransactionRequest = {
      chain,
      to: poolAddress,
      data: this.encodeRepay(assetAddress, amount, interestRateMode, userAddress),
      gas_limit: '300000',
    };
    
    const result = await this.wallet.sendTransaction(tx);
    return this.parseTransactionResult(result, chain);
  }

  /**
   * Get user account data (collateral, debt, health factor)
   */
  async getUserAccountData(chain: Chain): Promise<{
    totalCollateral: string;
    totalDebt: string;
    availableBorrows: string;
    currentLiquidationThreshold: string;
    ltv: string;
    healthFactor: string;
  }> {
    const poolAddress = this.getPoolAddress(chain);
    const userAddress = this.wallet.getAddress();
    if (!userAddress) {
      throw new Error('Wallet not initialized');
    }
    
    // This would typically be a contract call, simplified here
    console.log(`[Aave] Getting account data for ${userAddress} on ${chain}`);
    
    return {
      totalCollateral: '0',
      totalDebt: '0',
      availableBorrows: '0',
      currentLiquidationThreshold: '0',
      ltv: '0',
      healthFactor: '0',
    };
  }

  /**
   * Encode supply function call
   */
  private encodeSupply(asset: string, amount: string, onBehalfOf: string): string {
    // function signature: supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)
    const methodId = '0x617ba037';
    const encodedParams = this.encodeParams(
      ['address', 'uint256', 'address', 'uint16'],
      [asset, amount, onBehalfOf, '0']
    );
    return methodId + encodedParams;
  }

  /**
   * Encode withdraw function call
   */
  private encodeWithdraw(asset: string, amount: string, to: string): string {
    // function signature: withdraw(address asset, uint256 amount, address to)
    const methodId = '0x4e70d791';
    const encodedParams = this.encodeParams(
      ['address', 'uint256', 'address'],
      [asset, amount, to]
    );
    return methodId + encodedParams;
  }

  /**
   * Encode borrow function call
   */
  private encodeBorrow(asset: string, amount: string, rateMode: string, onBehalfOf: string): string {
    // function signature: borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)
    const methodId = '0x6c3b4f6f';
    const rateModeNum = rateMode === 'stable' ? '1' : '2';
    const encodedParams = this.encodeParams(
      ['address', 'uint256', 'uint256', 'uint16', 'address'],
      [asset, amount, rateModeNum, '0', onBehalfOf]
    );
    return methodId + encodedParams;
  }

  /**
   * Encode repay function call
   */
  private encodeRepay(asset: string, amount: string, rateMode: string, onBehalfOf: string): string {
    // function signature: repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf)
    const methodId = '0x573ade81';
    const rateModeNum = rateMode === 'stable' ? '1' : '2';
    const encodedParams = this.encodeParams(
      ['address', 'uint256', 'uint256', 'address'],
      [asset, amount, rateModeNum, onBehalfOf]
    );
    return methodId + encodedParams;
  }

  /**
   * Simple ABI encoder for common types
   */
  private encodeParams(types: string[], values: (string | number)[]): string {
    // Simplified encoder - in production, use a proper ABI encoder like ethers.js
    let result = '';
    for (let i = 0; i < types.length; i++) {
      const value = values[i].toString();
      if (types[i] === 'address') {
        // Pad address to 32 bytes
        result += value.padStart(64, '0');
      } else if (types[i] === 'uint256' || types[i] === 'uint16') {
        // Pad numeric value to 32 bytes
        result += BigInt(value).toString(16).padStart(64, '0');
      }
    }
    return result;
  }

  /**
   * Parse wallet transaction result to common format
   */
  private parseTransactionResult(result: import('../types/index.js').TransactionResult, chain: Chain): TransactionResult {
    return {
      chain,
      tx_hash: result.tx_hash || result.hash || '',
      status: result.status,
      block_number: result.block_number || result.blockNumber,
      gas_used: result.gas_used || result.gasUsed,
    };
  }
}