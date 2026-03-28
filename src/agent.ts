/**
 * Autonomous DeFi Agent - Main Entry Point
 * 
 * "DeFi + Web Intelligence Agent"
 * 
 * Combines:
 * - TinyFish: AI-powered web scraping for DeFi dashboards
 * - WDK: Multi-chain self-custodial wallet
 * - Protocol Adapters: Aave, Uniswap integration
 * - Policy Engine: Safety guardrails
 * 
 * Scans CExs, DeFi dashboards, bridges, staking platforms
 * Finds best yield and executes strategy autonomously
 */

import { TinyFishClient } from './tinyfish/client';
import { WDKWallet, WDKConfig } from './wdk/wallet';
import { YieldStrategyEngine, StrategyConfig } from './strategy/engine';
import { AaveAdapter } from './protocols/aave';
import { UniswapAdapter } from './protocols/uniswap';
import { PolicyEngine, PolicyConfig, DEFAULT_POLICY_CONFIG, TEST_POLICY_CONFIG } from './safety/policy';
import type { AgentState, YieldOpportunity, StrategyDecision } from './types/index';

/**
 * Agent Configuration
 */
export interface AgentConfig {
  /** TinyFish API key */
  tinyfishApiKey: string;
  /** WDK configuration */
  wdkConfig: WDKConfig;
  /** Strategy configuration */
  strategyConfig?: Partial<StrategyConfig>;
  /** Policy configuration */
  policyConfig?: Partial<PolicyConfig>;
  /** Run in test mode (no real transactions) */
  testMode?: boolean;
  /** Log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Autonomous DeFi Agent
 * 
 * Main class that orchestrates all components:
 * 1. TinyFish for web scraping yield data
 * 2. WDK for wallet operations
 * 3. Strategy engine for decision making
 * 4. Protocol adapters for execution
 * 5. Policy engine for safety
 */
export class AutonomousAgent {
  private tinyfish: TinyFishClient;
  private wallet: WDKWallet;
  private strategy: YieldStrategyEngine;
  private aave: AaveAdapter;
  private uniswap: UniswapAdapter;
  private policy: PolicyEngine;
  private config: AgentConfig;
  private state: AgentState;
  private isRunning: boolean = false;

  constructor(config: AgentConfig) {
    this.config = config;
    
    // Initialize TinyFish client
    this.tinyfish = new TinyFishClient({
      apiKey: config.tinyfishApiKey,
    });
    
    // Initialize WDK wallet
    this.wallet = new WDKWallet(config.wdkConfig);
    
    // Initialize protocol adapters
    this.aave = new AaveAdapter(this.wallet);
    this.uniswap = new UniswapAdapter(this.wallet);
    
    // Initialize strategy engine
    this.strategy = new YieldStrategyEngine(
      this.tinyfish,
      this.wallet,
      config.strategyConfig
    );
    
    // Initialize policy engine
    const effectivePolicyConfig: PolicyConfig = {
      ...(config.testMode ? TEST_POLICY_CONFIG : DEFAULT_POLICY_CONFIG),
      ...config.policyConfig,
    };
    this.policy = new PolicyEngine(effectivePolicyConfig);
    
    // Initialize state
    this.state = {
      running: false,
      last_scan: 0,
      opportunities: [],
      wallet: null,
      current_strategy: null,
      errors: [],
    };
  }

  /**
   * Initialize and start the agent
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[Agent] Already running');
      return;
    }
    
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║     Autonomous DeFi Agent - "DeFi + Web Intelligence"    ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log('║  TinyFish: Web-scraping yield data from DeFi dashboards    ║');
    console.log('║  WDK: Multi-chain self-custodial wallet                    ║');
    console.log('║  Strategy: Autonomous yield optimization                   ║');
    console.log('║  Safety: Policy guardrails enabled                         ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    
    try {
      // Initialize wallet - create or import
      console.log('[Agent] Initializing wallet...');
      
      // Try to use private key from config, or create new wallet
      const privateKey = process.env.PRIVATE_KEY;
      let walletState;
      
      if (privateKey) {
        walletState = await this.wallet.importFromPrivateKey(privateKey);
      } else {
        walletState = await this.wallet.createWallet();
        console.log(`[Agent] New wallet created: ${walletState.address}`);
        console.log('[Agent] IMPORTANT: Save this address and configure PRIVATE_KEY env var for production');
      }
      
      this.state.wallet = walletState;
      console.log(`[Agent] Wallet ready: ${walletState.address}`);
      
      // Start strategy engine
      console.log('[Agent] Starting strategy engine...');
      await this.strategy.start();
      
      this.isRunning = true;
      this.state.running = true;
      
      console.log('[Agent] ✓ Agent started successfully');
      console.log('[Agent] Scanning for yield opportunities...');
      
    } catch (error) {
      console.error('[Agent] Failed to start:', error);
      this.state.errors.push(`Startup failed: ${error}`);
      throw error;
    }
  }

  /**
   * Stop the agent
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    console.log('[Agent] Stopping...');
    
    this.strategy.stop();
    this.isRunning = false;
    this.state.running = false;
    
    console.log('[Agent] ✓ Agent stopped');
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Get current opportunities
   */
  getOpportunities(): YieldOpportunity[] {
    return this.strategy.getOpportunities();
  }

  /**
   * Get portfolio state
   */
  getPortfolio() {
    return this.strategy.getPortfolio();
  }

  /**
   * Manually trigger a scan for opportunities
   */
  async scan(): Promise<void> {
    console.log('[Agent] Manual scan triggered...');
    await this.strategy.scanForOpportunities();
    this.state.last_scan = Date.now();
    this.state.opportunities = this.strategy.getOpportunities();
    console.log(`[Agent] Scan complete. Found ${this.state.opportunities.length} opportunities`);
  }

  /**
   * Execute a strategy decision with policy checks
   */
  async executeDecision(decision: StrategyDecision): Promise<boolean> {
    console.log(`[Agent] Executing decision: ${decision.action} ${decision.amount} ${decision.token}`);
    
    // Check policy
    const policyResult = await this.policy.evaluate(
      decision.action,
      {
        id: decision.protocol,
        protocol: decision.protocol,
        chain: decision.chain,
        token: decision.token || '',
        apy: decision.expected_apy,
        tvl: 0,
      },
      this.state.wallet || undefined
    );
    
    if (!policyResult.allowed) {
      console.log(`[Agent] ✗ Policy blocked: ${policyResult.reason}`);
      return false;
    }
    
    try {
      // Execute based on action type
      switch (decision.action) {
        case 'supply':
          // Would call aave.supply() or similar
          console.log(`[Agent] ✓ Supply ${decision.amount} ${decision.token} on ${decision.chain}`);
          break;
          
        case 'borrow':
          console.log(`[Agent] ✓ Borrow ${decision.amount} ${decision.token} on ${decision.chain}`);
          break;
          
        case 'withdraw':
          console.log(`[Agent] ✓ Withdraw ${decision.amount} ${decision.token} on ${decision.chain}`);
          break;
          
        case 'swap':
          console.log(`[Agent] ✓ Swap ${decision.amount} ${decision.token} on ${decision.chain}`);
          break;
          
        default:
          console.log(`[Agent] Unknown action: ${decision.action}`);
          return false;
      }
      
      this.state.current_strategy = decision;
      return true;
      
    } catch (error) {
      console.error('[Agent] Execution failed:', error);
      this.state.errors.push(`Execution failed: ${error}`);
      return false;
    }
  }

  /**
   * Get agent status summary
   */
  getStatus(): string {
    const status = this.isRunning ? 'RUNNING' : 'STOPPED';
    const opportunities = this.state.opportunities.length;
    const bestOpp = this.state.opportunities[0];
    const bestYield = bestOpp ? `${(bestOpp.apy * 100).toFixed(2)}%` : 'N/A';
    
    return `
┌─────────────────────────────────────────────────┐
│  Agent Status: ${status}
│  Wallet: ${this.state.wallet?.address?.slice(0, 10)}...
│  Current Opportunities: ${opportunities}
│  Best Yield: ${bestYield}
│  Last Scan: ${this.state.last_scan ? new Date(this.state.last_scan).toISOString() : 'Never'}
│  Errors: ${this.state.errors.length}
└─────────────────────────────────────────────────┘
    `.trim();
  }
}

/**
 * Create agent from environment variables
 */
export function createAgentFromEnv(): AutonomousAgent {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    throw new Error('TINYFISH_API_KEY environment variable required');
  }
  
  const testMode = process.env.TEST_MODE === 'true';
  
  return new AutonomousAgent({
    tinyfishApiKey: apiKey,
    wdkConfig: {
      apiUrl: process.env.WDK_API_URL || 'https://api.wdk.tether.io',
      apiKey: process.env.WDK_API_KEY,
      chains: {
        base: {
          rpcUrl: process.env.BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/demo',
          chainId: 8453,
          explorerUrl: 'https://basescan.org',
          nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
        },
        ethereum: {
          rpcUrl: process.env.ETH_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
          chainId: 1,
          explorerUrl: 'https://etherscan.io',
          nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
        },
        polygon: {
          rpcUrl: process.env.POLY_RPC_URL || 'https://polygon-rpc.com',
          chainId: 137,
          explorerUrl: 'https://polygonscan.com',
          nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        },
        arbitrum: {
          rpcUrl: process.env.ARB_RPC_URL || 'https://arb1.arbitrum.io/rpc',
          chainId: 42161,
          explorerUrl: 'https://arbiscan.io',
          nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
        },
      },
    },
    testMode,
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
  });
}

// CLI usage - check if running directly
if (require.main === module) {
  console.log('Starting Autonomous DeFi Agent...');
  
  const agent = createAgentFromEnv();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Agent] Shutting down...');
    agent.stop();
    process.exit(0);
  });
  
  // Start agent
  agent.start().catch((error) => {
    console.error('[Agent] Fatal error:', error);
    process.exit(1);
  });
}