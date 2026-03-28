/**
 * WDK Wallet Integration
 * 
 * WDK (Wallet Development Kit) from Tether provides:
 * - Multi-chain self-custodial wallet functionality
 * - Transaction signing and broadcasting
 * - Cross-chain operations support
 * 
 * Documentation: https://docs.wdk.tether.io/
 */

import { ethers } from 'ethers';
import type { WalletState, TransactionRequest, TransactionResult, Chain } from '../types/index.js';

/**
 * WDK Wallet Configuration
 */
export interface WDKConfig {
  /** WDK API endpoint */
  apiUrl: string;
  /** Authentication key */
  apiKey?: string;
  /** Chain configuration */
  chains: Record<Chain, ChainConfig>;
}

/**
 * Chain-specific configuration
 */
export interface ChainConfig {
  /** RPC URL for the chain */
  rpcUrl: string;
  /** Chain ID */
  chainId: number;
  /** Explorer API URL */
  explorerUrl: string;
  /** Native currency */
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

/**
 * WDK Wallet Client
 * 
 * Handles wallet operations:
 * - Create/unlock wallets
 * - Read balances
 * - Sign and broadcast transactions
 * - Check transaction status
 */
export class WDKWallet {
  private config: WDKConfig;
  private providers: Map<Chain, ethers.JsonRpcProvider> = new Map();
  private signingWallet: ethers.Wallet | null = null;
  private address: string | null = null;

  constructor(config: WDKConfig) {
    this.config = config;
    this.initializeProviders();
  }

  /**
   * Initialize RPC providers for each configured chain
   */
  private initializeProviders(): void {
    for (const [chain, chainConfig] of Object.entries(this.config.chains) as [Chain, ChainConfig][]) {
      this.providers.set(chain, new ethers.JsonRpcProvider(chainConfig.rpcUrl));
    }
  }

  /**
   * Create a new wallet
   * 
   * Generates a new random wallet with mnemonic
   */
  async createWallet(): Promise<WalletState> {
    const wallet = ethers.Wallet.createRandom() as unknown as ethers.Wallet;
    this.signingWallet = wallet;
    this.address = wallet.address;

    return {
      address: wallet.address,
      chain: 'base',
      chains: ['base'],
      balance: '0',
      balances: { base: '0' },
      nonce: 0,
      is_unlocked: true,
      isLocked: false,
    };
  }

  /**
   * Import wallet from mnemonic
   * 
   * @param mnemonic 12 or 24 word mnemonic phrase
   */
  async importWallet(mnemonic: string): Promise<WalletState> {
    // Use type assertion to handle ethers v6's return type
    const wallet = ethers.Wallet.fromPhrase(mnemonic) as unknown as ethers.Wallet;
    this.signingWallet = wallet;
    this.address = wallet.address;

    return this.getWalletState('base');
  }

  /**
   * Import wallet from private key
   * 
   * @param privateKey Hex string (with 0x prefix)
   */
  async importFromPrivateKey(privateKey: string): Promise<WalletState> {
    const wallet = new ethers.Wallet(privateKey);
    this.signingWallet = wallet;
    this.address = wallet.address;

    return this.getWalletState('base');
  }

  /**
   * Get current wallet state
   */
  async getWalletState(chain: Chain): Promise<WalletState> {
    if (!this.address) {
      throw new Error('Wallet not initialized');
    }

    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Chain ${chain} not configured`);
    }

    const balance = await provider.getBalance(this.address);
    const nonce = await provider.getTransactionCount(this.address);

    return {
      address: this.address,
      chain,
      chains: [chain],
      balance: balance.toString(),
      balances: { [chain]: balance.toString() } as Partial<Record<Chain, string>>,
      nonce,
      is_unlocked: this.signingWallet !== null,
      isLocked: this.signingWallet === null,
    };
  }

  /**
   * Get native token balance
   */
  async getBalance(chain: Chain): Promise<string> {
    if (!this.address) {
      throw new Error('Wallet not initialized');
    }

    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Chain ${chain} not configured`);
    }

    const balance = await provider.getBalance(this.address);
    return balance.toString();
  }

  /**
   * Get ERC20 token balance
   */
  async getTokenBalance(chain: Chain, tokenAddress: string): Promise<string> {
    if (!this.address) {
      throw new Error('Wallet not initialized');
    }

    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Chain ${chain} not configured`);
    }

    const tokenAbi = [
      'function balanceOf(address owner) view returns (uint256)',
    ];

    const token = new ethers.Contract(tokenAddress, tokenAbi, provider);
    const balance = await token.balanceOf(this.address);
    return balance.toString();
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(tx: TransactionRequest): Promise<string> {
    const provider = this.providers.get(tx.chain);
    if (!provider || !this.signingWallet) {
      throw new Error('Wallet or provider not initialized');
    }

    const signer = this.signingWallet.connect(provider);
    
    const transaction: ethers.TransactionRequest = {
      to: tx.to,
      value: tx.value ? BigInt(tx.value) : undefined,
      data: tx.data || '0x',
      gasLimit: tx.gas_limit ? BigInt(tx.gas_limit) : undefined,
    };

    try {
      const gasEstimate = await provider.estimateGas(transaction);
      // Add 20% buffer for safety
      return (gasEstimate * 120n / 100n).toString();
    } catch (error) {
      // Return default gas limit if estimation fails
      return '21000';
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(chain: Chain): Promise<{ gasPrice: string; maxFeePerGas: string; maxPriorityFeePerGas: string }> {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Chain ${chain} not configured`);
    }

    const feeData = await provider.getFeeData();

    return {
      gasPrice: feeData.gasPrice?.toString() || '0',
      maxFeePerGas: feeData.maxFeePerGas?.toString() || '0',
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || '0',
    };
  }

  /**
   * Sign and send a transaction
   * 
   * Signs the transaction with the wallet and broadcasts to the network
   */
  async sendTransaction(tx: TransactionRequest): Promise<TransactionResult> {
    if (!this.signingWallet) {
      throw new Error('Wallet not initialized or locked');
    }

    const provider = this.providers.get(tx.chain);
    if (!provider) {
      throw new Error(`Chain ${tx.chain} not configured`);
    }

    const signer = this.signingWallet.connect(provider);

    try {
      // Get fee data
      const feeData = await provider.getFeeData();
      
      // Build transaction
      const transaction: ethers.TransactionRequest = {
        to: tx.to,
        value: tx.value ? BigInt(tx.value) : undefined,
        data: tx.data || '0x',
        gasLimit: tx.gas_limit ? BigInt(tx.gas_limit) : undefined,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        nonce: tx.nonce,
      };

      // Sign and send
      const response = await signer.sendTransaction(transaction);

      return {
        chain: tx.chain,
        tx_hash: response.hash,
        from: this.address!,
        to: tx.to,
        value: tx.value || '0',
        status: 'pending',
        block_number: response.blockNumber || 0,
        timestamp: Date.now(),
        gas_used: '0',
        gas_price: feeData.gasPrice?.toString() || '0',
      };
    } catch (error) {
      return {
        chain: tx.chain,
        tx_hash: '',
        from: this.address!,
        to: tx.to,
        value: tx.value || '0',
        status: 'failed',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(txHash: string, chain: Chain, confirmations: number = 1): Promise<TransactionResult> {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Chain ${chain} not configured`);
    }

    const receipt = await provider.waitForTransaction(txHash, confirmations);

    return {
      chain,
      tx_hash: txHash,
      from: this.address!,
      to: '',
      value: '0',
      status: receipt?.status === 1 ? 'confirmed' : 'failed',
      block_number: receipt?.blockNumber,
      timestamp: Date.now(),
      gas_used: receipt?.gasUsed?.toString() || '0',
    };
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string, chain: Chain): Promise<ethers.TransactionReceipt | null> {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Chain ${chain} not configured`);
    }

    return await provider.getTransactionReceipt(txHash);
  }

  /**
   * Lock wallet (clear private key from memory)
   */
  lock(): void {
    this.signingWallet = null;
  }

  /**
   * Check if wallet is unlocked
   */
  isUnlocked(): boolean {
    return this.signingWallet !== null;
  }

  /**
   * Get wallet address
   */
  getAddress(): string | null {
    return this.address;
  }
}

/**
 * Default WDK configuration for testnet chains
 */
export const DEFAULT_WDK_CONFIG: WDKConfig = {
  apiUrl: 'https://api.wdk.tether.io',
  chains: {
    base: {
      rpcUrl: process.env.BASE_RPC_URL || 'https://sepolia.base.org',
      chainId: 84532,
      explorerUrl: 'https://sepolia.basescan.org',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
    },
    polygon: {
      rpcUrl: process.env.POLYGON_RPC_URL || 'https://rpc-amoy.polygon.technology',
      chainId: 80002,
      explorerUrl: 'https://amoy.polygonscan.com',
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18,
      },
    },
    arbitrum: {
      rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://sepolia.arbitrum.io/rpc',
      chainId: 421614,
      explorerUrl: 'https://sepolia.arbiscan.io',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
    },
    ethereum: {
      rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
      chainId: 11155111,
      explorerUrl: 'https://sepolia.etherscan.io',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18,
      },
    },
  },
};

/**
 * Create a WDK wallet instance with default configuration
 */
export function createWDKWallet(config?: Partial<WDKConfig>): WDKWallet {
  return new WDKWallet({
    ...DEFAULT_WDK_CONFIG,
    ...config,
    chains: {
      ...DEFAULT_WDK_CONFIG.chains,
      ...config?.chains,
    },
  });
}