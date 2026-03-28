/**
 * Uniswap Protocol Adapter
 * 
 * Handles interaction with Uniswap V3 across supported chains:
 * - Swap tokens
 * - Add liquidity to pools
 * - Remove liquidity
 * - Get quotes
 */

import type { Chain, UniswapPool, UniswapQuote, TransactionRequest, TransactionResult } from '../types/index.js';
import { WDKWallet } from '../wdk/wallet.js';

// Uniswap V3 Router addresses by chain
const UNISWAP_ROUTER_ADDRESSES: Record<Chain, string> = {
  ethereum: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  polygon: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  arbitrum: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  base: '0x2626664c2603336E57B271c5C0b26F4422fEE2d7',
};

// Factory addresses by chain
const UNISWAP_FACTORY_ADDRESSES: Record<Chain, string> = {
  ethereum: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  polygon: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  arbitrum: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  base: '0x33128a8fC572A69BF8C56AC2cA8bF5F2e32d8A3d',
};

const ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) returns (uint256 amountOut)',
  'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) returns (uint256 amountOut)',
  'function exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96)) returns (uint256 amountIn)',
  'function multicall(bytes[] data) returns (bytes[] results)',
];

/**
 * Uniswap Adapter class for interacting with Uniswap V3
 */
export class UniswapAdapter {
  private wallet: WDKWallet;
  
  constructor(wallet: WDKWallet) {
    this.wallet = wallet;
  }

  /**
   * Get the router address for a given chain
   */
  private getRouterAddress(chain: Chain): string {
    const address = UNISWAP_ROUTER_ADDRESSES[chain];
    if (!address) {
      throw new Error(`Uniswap not available on chain: ${chain}`);
    }
    return address;
  }

  /**
   * Get the factory address for a given chain
   */
  private getFactoryAddress(chain: Chain): string {
    const address = UNISWAP_FACTORY_ADDRESSES[chain];
    if (!address) {
      throw new Error(`Uniswap not available on chain: ${chain}`);
    }
    return address;
  }

  /**
   * Get pools data for a chain (via TinyFish web scraping)
   */
  async getPools(chain: Chain): Promise<UniswapPool[]> {
    // This would be handled by the strategy engine scanning app.uniswap.org
    console.log(`[Uniswap] Getting pools for ${chain}`);
    return [];
  }

  /**
   * Get a quote for a token swap
   */
  async getQuote(
    chain: Chain,
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    fee: number = 3000 // Default 0.3% fee tier
  ): Promise<UniswapQuote> {
    // In production, this would query the Quoter contract or use subgraph
    // Simplified here - returns mock data
    console.log(`[Uniswap] Getting quote for ${amountIn} ${tokenIn} -> ${tokenOut} on ${chain}`);
    
    // Mock output calculation (in production, use actual pricing)
    const outputAmount = (BigInt(amountIn) * BigInt(1000)).toString();
    
    return {
      input_amount: amountIn,
      output_amount: outputAmount,
      path: [tokenIn, tokenOut],
      slippage: 0.01,
      gas_estimate: '150000',
    };
  }

  /**
   * Execute a token swap (exact input single)
   */
  async swapExactInput(
    chain: Chain,
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    amountOutMinimum: string,
    fee: number = 3000,
    sqrtPriceLimitX96?: string
  ): Promise<TransactionResult> {
    const routerAddress = this.getRouterAddress(chain);
    const userAddress = this.wallet.getAddress();
    if (!userAddress) {
      throw new Error('Wallet not initialized');
    }
    
    console.log(`[Uniswap] Swapping ${amountIn} ${tokenIn} for ${tokenOut} on ${chain}`);
    
    // Encode exactInputSingle parameters
    const params: string[] = [
      tokenIn,           // tokenIn
      tokenOut,          // tokenOut
      fee.toString(),    // fee
      userAddress,       // recipient
      String(Math.floor(Date.now() / 1000) + 600), // deadline (10 minutes)
      amountIn,          // amountIn
      amountOutMinimum,  // amountOutMinimum
      sqrtPriceLimitX96 || '0', // sqrtPriceLimitX96
    ];
    
    const data = this.encodeExactInputSingle(params);
    
    const tx: TransactionRequest = {
      chain,
      to: routerAddress,
      data,
      gas_limit: '200000',
    };
    
    const result = await this.wallet.sendTransaction(tx);
    return this.parseTransactionResult(result, chain);
  }

  /**
   * Execute a token swap (exact output single)
   */
  async swapExactOutput(
    chain: Chain,
    tokenIn: string,
    tokenOut: string,
    amountOut: string,
    amountInMaximum: string,
    fee: number = 3000,
    sqrtPriceLimitX96?: string
  ): Promise<TransactionResult> {
    const routerAddress = this.getRouterAddress(chain);
    const userAddress = this.wallet.getAddress();
    if (!userAddress) {
      throw new Error('Wallet not initialized');
    }
    
    console.log(`[Uniswap] Swapping max ${amountInMaximum} ${tokenIn} for ${amountOut} ${tokenOut} on ${chain}`);
    
    const params: string[] = [
      tokenIn,           // tokenIn
      tokenOut,          // tokenOut
      fee.toString(),    // fee
      userAddress,       // recipient
      String(Math.floor(Date.now() / 1000) + 600), // deadline (10 minutes)
      amountOut,         // amountOut
      amountInMaximum,   // amountInMaximum
      sqrtPriceLimitX96 || '0', // sqrtPriceLimitX96
    ];
    
    const data = this.encodeExactOutputSingle(params);
    
    const tx: TransactionRequest = {
      chain,
      to: routerAddress,
      data,
      gas_limit: '200000',
    };
    
    const result = await this.wallet.sendTransaction(tx);
    return this.parseTransactionResult(result, chain);
  }

  /**
   * Add liquidity to a position (simplified - would need position manager for full implementation)
   */
  async addLiquidity(
    chain: Chain,
    token0: string,
    token1: string,
    amount0: string,
    amount1: string,
    fee: number = 3000,
    tickLower?: number,
    tickUpper?: number
  ): Promise<TransactionResult> {
    const routerAddress = this.getRouterAddress(chain);
    
    console.log(`[Uniswap] Adding liquidity for ${token0}/${token1} on ${chain}`);
    
    // In production, this would use the NonFungiblePositionManager
    // Simplified here - just approval and multi-call
    const data = '0x'; // Would be multicall with increaseLiquidity
    
    const tx: TransactionRequest = {
      chain,
      to: routerAddress,
      data,
      value: amount0, // If adding native token liquidity
      gas_limit: '400000',
    };
    
    const result = await this.wallet.sendTransaction(tx);
    return this.parseTransactionResult(result, chain);
  }

  /**
   * Remove liquidity from a position
   */
  async removeLiquidity(
    chain: Chain,
    token0: string,
    token1: string,
    liquidity: string,
    fee: number = 3000
  ): Promise<TransactionResult> {
    const routerAddress = this.getRouterAddress(chain);
    
    console.log(`[Uniswap] Removing liquidity for ${token0}/${token1} on ${chain}`);
    
    // In production, this would use the NonFungiblePositionManager
    const data = '0x'; // Would be multicall with decreaseLiquidity
    
    const tx: TransactionRequest = {
      chain,
      to: routerAddress,
      data,
      gas_limit: '300000',
    };
    
    const result = await this.wallet.sendTransaction(tx);
    return this.parseTransactionResult(result, chain);
  }

  /**
   * Get pool address for a token pair
   */
  getPoolAddress(chain: Chain, token0: string, token1: string, fee: number): string {
    // In production, would call factory.getPool(token0, token1, fee)
    // For now, return null as this requires on-chain calls
    const factory = this.getFactoryAddress(chain);
    console.log(`[Uniswap] Pool address for ${token0}/${token1} (fee: ${fee}) at ${factory}`);
    return '';
  }

  /**
   * Encode exactInputSingle function call
   */
  private encodeExactInputSingle(params: string[]): string {
    // function signature: exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96))
    const methodId = '0x04e45aaf';
    
    // ABI encode the struct
    let encoded = '';
    for (const param of params) {
      if (param.startsWith('0x')) {
        // Address - pad to 32 bytes
        encoded += param.padStart(64, '0');
      } else {
        // Numeric value - convert to uint256
        encoded += BigInt(param).toString(16).padStart(64, '0');
      }
    }
    
    return methodId + encoded;
  }

  /**
   * Encode exactOutputSingle function call
   */
  private encodeExactOutputSingle(params: string[]): string {
    // function signature: exactOutputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountOut, uint256 amountInMaximum, uint160 sqrtPriceLimitX96))
    const methodId = '0x9b3c42b6';
    
    let encoded = '';
    for (const param of params) {
      if (param.startsWith('0x')) {
        encoded += param.padStart(64, '0');
      } else {
        encoded += BigInt(param).toString(16).padStart(64, '0');
      }
    }
    
    return methodId + encoded;
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