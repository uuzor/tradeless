/**
 * Yield Strategy Engine
 * 
 * Core component that:
 * - Scans for yield opportunities across protocols
 * - Compares yields and calculates optimal allocation
 * - Generates rebalancing decisions
 * - Manages portfolio state
 */

import type { YieldOpportunity, StrategyDecision, AgentState, Chain, ProtocolType, ScanTarget, TinyFishAutomationResult } from '../types/index.js';
import { TinyFishClient } from '../tinyfish/client.js';
import { WDKWallet } from '../wdk/wallet.js';

/**
 * Strategy Configuration
 */
export interface StrategyConfig {
  /** Minimum APY to consider (as decimal, e.g., 0.05 = 5%) */
  minApy: number;
  /** Maximum TVL to consider (in USD) */
  maxTvl?: number;
  /** Rebalance threshold (when to rebalance portfolio) */
  rebalanceThreshold: number;
  /** Maximum positions to hold */
  maxPositions: number;
  /** Minimum position size (as decimal of total portfolio) */
  minPositionSize: number;
  /** Check interval in milliseconds */
  checkInterval: number;
  /** Run automation only once (disable periodic scan when true) */
  runOnce?: boolean;
  /** Slippage tolerance for swaps (as decimal) */
  slippageTolerance: number;
}

/**
 * Portfolio Position
 */
export interface PortfolioPosition {
  protocol: string;
  chain: Chain;
  token: string;
  amount: string;
  value: number;
  apy: number;
  lastUpdated: number;
}

/**
 * Portfolio State
 */
export interface PortfolioState {
  totalValue: number;
  positions: PortfolioPosition[];
  lastRebalance: number;
}

/**
 * Yield Strategy Engine
 */
export class YieldStrategyEngine {
  private tinyfish: TinyFishClient;
  private wallet: WDKWallet;
  private config: StrategyConfig;
  private portfolio: PortfolioState;
  private opportunities: YieldOpportunity[] = [];
  private isRunning: boolean = false;

  constructor(
    tinyfish: TinyFishClient,
    wallet: WDKWallet,
    config: Partial<StrategyConfig> = {}
  ) {
    this.tinyfish = tinyfish;
    this.wallet = wallet;
    this.config = {
      minApy: config.minApy ?? 0.02,
      maxTvl: config.maxTvl ?? 100_000_000,
      rebalanceThreshold: config.rebalanceThreshold ?? 0.1,
      maxPositions: config.maxPositions ?? 5,
      minPositionSize: config.minPositionSize ?? 0.05,
      checkInterval: config.checkInterval ?? 300_000, // 5 minutes
      slippageTolerance: config.slippageTolerance ?? 0.005,
      checkInterval: config.checkInterval ?? 3600000, // 1 hour
    };
    
    this.portfolio = {
      totalValue: 0,
      positions: [],
      lastRebalance: Date.now(),
    };
  }

  /**
   * Start the strategy engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[Strategy] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[Strategy] Starting yield strategy engine...');
    
    // Initial scan
    await this.scanForOpportunities();
    
    // Start periodic scanning
    this.runLoop();
  }

  /**
   * Stop the strategy engine
   */
  stop(): void {
    this.isRunning = false;
    console.log('[Strategy] Stopped yield strategy engine');
  }

  /**
   * Main strategy loop
   */
  private runLoop(): void {
    if (!this.isRunning) return;

    setTimeout(async () => {
      try {
        await this.scanForOpportunities();
        await this.evaluateAndRebalance();
      } catch (error) {
        console.error('[Strategy] Error in loop:', error);
      }
      
      this.runLoop();
    }, this.config.checkInterval);
  }

  /**
   * Scan for yield opportunities using TinyFish
   * 
   * Scrapes DeFi dashboards to find:
   * - Lending rates
   * - Staking rewards
   * - LP yields
   * - Bridge incentives
   */
  async scanForOpportunities(): Promise<void> {
    console.log('[Strategy] Scanning for yield opportunities...');
    
    const scanTargets = this.getScanTargets();
    const results = await this.tinyfish.scanMultiple(scanTargets);
    
    // Parse and normalize opportunities from results
    this.opportunities = this.parseOpportunities(results);
    
    // Filter and sort by APY
    this.opportunities = this.filterOpportunities(this.opportunities);
    
    console.log(`[Strategy] Found ${this.opportunities.length} yield opportunities`);
    
    // Log top opportunities
    const top = this.opportunities.slice(0, 5);
    for (const opp of top) {
      console.log(`  - ${opp.protocol} on ${opp.chain}: ${(opp.apy * 100).toFixed(2)}% APY`);
    }
  }

  /**
   * Get list of targets to scan
   */
  private getScanTargets(): ScanTarget[] {
    return [
      // Lending platforms
      { 
        id: 'aave_base', 
        url: 'https://app.aave.com/markets/', 
        goal: 'Extract current supply APY rates for all assets, including lending pools and liquidity amounts',
        chain: 'base', 
        protocol: 'aave',
        priority: 1
      },
      { 
        id: 'compound', 
        url: 'https://compound.finance/markets', 
        goal: 'Extract current supply rates and borrow rates for all assets',
        chain: 'ethereum', 
        protocol: 'compound',
        priority: 2
      },
      { 
        id: 'radiant', 
        url: 'https://app.radiant.capital/', 
        goal: 'Extract lending APY rates and pool liquidity data',
        chain: 'arbitrum', 
        protocol: 'radiant',
        priority: 3
      },
      
      // DEX/LP
      { 
        id: 'uniswap', 
        url: 'https://app.uniswap.org/pools', 
        goal: 'Extract all visible token pools with their liquidity amounts and token pair symbols',
        chain: 'base', 
        protocol: 'uniswap',
        priority: 2
      },
      { 
        id: 'sushi', 
        url: 'https://app.sushi.com/pool', 
        goal: 'Extract pool data with token pairs, liquidity, and fees',
        chain: 'arbitrum', 
        protocol: 'sushi',
        priority: 3
      },
      { 
        id: 'curve', 
        url: 'https://curve.fi/pools', 
        goal: 'Extract stablecoin pool data with APY and TVL',
        chain: 'ethereum', 
        protocol: 'curve',
        priority: 3
      },
      
      // Aggregators
      { 
        id: 'yearn', 
        url: 'https://app.yearn.finance/', 
        goal: 'Extract vault data with current APY and total value locked',
        chain: 'ethereum', 
        protocol: 'yearn',
        priority: 2
      },
      { 
        id: 'grand', 
        url: 'https://app.grand.xyz/', 
        goal: 'Extract yield aggregator rates and available strategies',
        chain: 'base', 
        protocol: 'grand',
        priority: 3
      },
      
      // Cross-chain
      { 
        id: 'stargate', 
        url: 'https://app.stargate.finance/', 
        goal: 'Extract bridge incentives, cross-chain rewards and TVL',
        chain: 'base', 
        protocol: 'stargate',
        priority: 2
      },
      { 
        id: 'orbiter', 
        url: 'https://app.orbiter.finance/', 
        goal: 'Extract bridge fee data and any yield incentives',
        chain: 'base', 
        protocol: 'orbiter',
        priority: 3
      },
    ];
  }

  /**
   * Parse scan results into yield opportunities
   */
  private parseOpportunities(results: Map<string, TinyFishAutomationResult>): YieldOpportunity[] {
    const opportunities: YieldOpportunity[] = [];
    
    for (const [targetId, result] of results) {
      try {
        const data = result.extracted_data as {
          yields?: Array<{
            protocol: string;
            chain: string;
            token: string;
            apy: number;
            tvl: number;
          }>;
        };

        if (data?.yields) {
          for (const yieldInfo of data.yields) {
            if (yieldInfo.apy > 0) {
              opportunities.push({
                id: `${yieldInfo.protocol}-${yieldInfo.chain}-${yieldInfo.token}-${Date.now()}`,
                protocol: yieldInfo.protocol,
                chain: yieldInfo.chain as Chain,
                apy: yieldInfo.apy,
                tvl: yieldInfo.tvl,
                token: yieldInfo.token,
                type: this.inferProtocolType(yieldInfo.protocol),
                risk_score: this.calculateRiskScore(yieldInfo.protocol, yieldInfo.chain),
                min_deposit: '0',
                max_deposit: '1000000000',
                url: '',
              });
            }
          }
        }
      } catch (error) {
        console.warn(`[Strategy] Failed to parse results from ${targetId}:`, error);
      }
    }
    
    return opportunities;
  }

  /**
   * Filter opportunities based on configuration
   */
  private filterOpportunities(opportunities: YieldOpportunity[]): YieldOpportunity[] {
    return opportunities
      .filter(opp => opp.apy >= this.config.minApy)
      .filter(opp => !this.config.maxTvl || opp.tvl <= this.config.maxTvl)
      .sort((a, b) => b.apy - a.apy);
  }

  /**
   * Infer protocol type from name
   */
  private inferProtocolType(protocol: string): ProtocolType {
    const lower = protocol.toLowerCase();
    if (lower.includes('aave') || lower.includes('compound') || lower.includes('euler')) {
      return 'lending';
    }
    if (lower.includes('uniswap') || lower.includes('sushi') || lower.includes('curve')) {
      return 'lp';
    }
    if (lower.includes('lido') || lower.includes('rocket')) {
      return 'staking';
    }
    if (lower.includes('stargate') || lower.includes('orbiter')) {
      return 'bridge';
    }
    if (lower.includes('yearn')) {
      return 'vault';
    }
    return 'other';
  }

  /**
   * Calculate risk score for a protocol (0-1, higher = riskier)
   */
  private calculateRiskScore(protocol: string, chain: string): number {
    let score = 0.3; // Base risk
    
    // Protocol risk
    const knownSafe = ['aave', 'compound', 'uniswap', 'curve', 'lido'];
    const knownRisky = ['euler', 'cream', 'voyager', 'celsius', 'blockfi'];
    
    if (knownRisky.some(p => protocol.toLowerCase().includes(p))) {
      score += 0.4;
    } else if (!knownSafe.some(p => protocol.toLowerCase().includes(p))) {
      score += 0.1;
    }
    
    // Chain risk (L2s and newer chains have higher risk)
    const riskyChains = ['arbitrum', 'optimism', 'polygon', 'base', 'fantom', 'avalanche'];
    if (riskyChains.includes(chain.toLowerCase())) {
      score += 0.1;
    }
    
    return Math.min(score, 1);
  }

  /**
   * Evaluate portfolio and generate rebalancing decisions
   */
  async evaluateAndRebalance(): Promise<void> {
    if (this.opportunities.length === 0) {
      console.log('[Strategy] No opportunities to evaluate');
      return;
    }
    
    // Calculate current portfolio allocation
    await this.updatePortfolioValue();
    
    // Check if rebalancing is needed
    const needsRebalance = this.checkRebalanceNeeded();
    
    if (needsRebalance) {
      console.log('[Strategy] Rebalancing portfolio...');
      const decision = await this.generateDecision();
      
      if (decision) {
        console.log(`[Strategy] Executing: ${decision.action} ${decision.amount} ${decision.token} on ${decision.chain}`);
        // Would execute the decision here
      }
    }
  }

  /**
   * Update portfolio value by checking all chain balances
   */
  private async updatePortfolioValue(): Promise<void> {
    const chains: Chain[] = ['base', 'ethereum', 'polygon', 'arbitrum'];
    let totalValue = 0;
    
    for (const chain of chains) {
      try {
        const balance = await this.wallet.getBalance(chain);
        totalValue += parseFloat(balance) / 1e18; // Assuming ETH/native
      } catch (e) {
        // Chain might not be configured
      }
    }
    
    this.portfolio.totalValue = totalValue;
  }

  /**
   * Check if portfolio needs rebalancing
   */
  private checkRebalanceNeeded(): boolean {
    // Time-based rebalance
    const timeSinceRebalance = Date.now() - this.portfolio.lastRebalance;
    if (timeSinceRebalance > this.config.checkInterval * 2) {
      return true;
    }
    
    // No opportunities
    if (this.opportunities.length === 0) return false;
    
    // Check if there's a significantly better opportunity
    const bestOpp = this.opportunities[0];
    const currentPositions = this.portfolio.positions;
    
    for (const pos of currentPositions) {
      if (bestOpp.apy - pos.apy > this.config.rebalanceThreshold) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Generate a strategy decision based on current state
   */
  private async generateDecision(): Promise<StrategyDecision | null> {
    if (this.opportunities.length === 0 || this.portfolio.positions.length >= this.config.maxPositions) {
      return null;
    }
    
    const best = this.opportunities[0];
    const positionSize = this.portfolio.totalValue * this.config.minPositionSize;
    
    return {
      action: 'supply',
      protocol: best.protocol,
      chain: best.chain,
      token: best.token,
      amount: positionSize.toString(),
      expected_apy: best.apy,
      reason: `Yield optimization: ${best.apy * 100}% APY vs current positions`,
    };
  }

  /**
   * Get current opportunities
   */
  getOpportunities(): YieldOpportunity[] {
    return this.opportunities;
  }

  /**
   * Get portfolio state
   */
  getPortfolio(): PortfolioState {
    return this.portfolio;
  }
}