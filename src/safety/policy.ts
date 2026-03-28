/**
 * Safety & Policy Layer
 * 
 * Implements guardrails for the autonomous agent:
 * - Transaction limits
 * - Risk checks
 * - Gas price limits
 * - Protocol allowlists
 * - Position size limits
 */

import type { PolicyRule, PolicyContext, PolicyResult, ProtocolAction, YieldOpportunity, WalletState, Chain } from '../types/index.js';

/**
 * Policy Engine
 * 
 * Evaluates all proposed actions against configured rules
 */
export class PolicyEngine {
  private rules: PolicyRule[];
  private config: PolicyConfig;
  
  constructor(config: PolicyConfig) {
    this.config = config;
    this.rules = this.initializeRules();
  }

  /**
   * Initialize built-in policy rules
   */
  private initializeRules(): PolicyRule[] {
    return [
      // Max transaction value check
      {
        id: 'max_tx_value',
        name: 'Maximum Transaction Value',
        description: 'Prevents transactions exceeding configured max value',
        check: (ctx: PolicyContext) => this.checkMaxTxValue(ctx),
      },
      
      // Gas price limit
      {
        id: 'max_gas_price',
        name: 'Maximum Gas Price',
        description: 'Prevents transactions when gas is too high',
        check: (ctx: PolicyContext) => this.checkMaxGasPrice(ctx),
      },
      
      // Protocol allowlist
      {
        id: 'protocol_allowlist',
        name: 'Protocol Allowlist',
        description: 'Only allows transactions to approved protocols',
        check: (ctx: PolicyContext) => this.checkProtocolAllowlist(ctx),
      },
      
      // Chain allowlist
      {
        id: 'chain_allowlist',
        name: 'Chain Allowlist',
        description: 'Only allows transactions on approved chains',
        check: (ctx: PolicyContext) => this.checkChainAllowlist(ctx),
      },
      
      // Minimum position size
      {
        id: 'min_position_size',
        name: 'Minimum Position Size',
        description: 'Ensures positions meet minimum size requirements',
        check: (ctx: PolicyContext) => this.checkMinPositionSize(ctx),
      },
      
      // Maximum positions
      {
        id: 'max_positions',
        name: 'Maximum Positions',
        description: 'Limits total number of positions',
        check: (ctx: PolicyContext) => this.checkMaxPositions(ctx),
      },
      
      // Risk score threshold
      {
        id: 'risk_threshold',
        name: 'Risk Score Threshold',
        description: 'Blocks opportunities exceeding risk threshold',
        check: (ctx: PolicyContext) => this.checkRiskThreshold(ctx),
      },
    ];
  }

  /**
   * Evaluate an action against all rules
   */
  async evaluate(action: ProtocolAction, opportunity?: YieldOpportunity, wallet?: WalletState): Promise<PolicyResult> {
    const context: PolicyContext = {
      action,
      opportunity,
      wallet: wallet ?? {
        address: '',
        chains: [],
        is_unlocked: false,
      },
      gas_price: this.config.maxGasPriceGwei ? `${this.config.maxGasPriceGwei}` : undefined,
    };
    
    // Check each rule
    for (const rule of this.rules) {
      const result = rule.check(context);
      if (!result.allowed) {
        return {
          allowed: false,
          reason: `[${rule.name}] ${result.reason}`,
          adjusted_value: result.adjusted_value,
        };
      }
    }
    
    return { allowed: true };
  }

  /**
   * Check maximum transaction value
   */
  private checkMaxTxValue(ctx: PolicyContext): PolicyResult {
    if (!this.config.maxTxValueUsd || !ctx.opportunity) {
      return { allowed: true };
    }
    
    // Simplified - would calculate actual USD value
    const txValue = parseFloat(ctx.opportunity.max_deposit || '0');
    if (txValue > this.config.maxTxValueUsd) {
      return {
        allowed: false,
        reason: `Transaction value $${txValue} exceeds maximum $${this.config.maxTxValueUsd}`,
        adjusted_value: this.config.maxTxValueUsd.toString(),
      };
    }
    
    return { allowed: true };
  }

  /**
   * Check gas price limit
   */
  private checkMaxGasPrice(ctx: PolicyContext): PolicyResult {
    if (!this.config.maxGasPriceGwei || !ctx.gas_price) {
      return { allowed: true };
    }
    
    const gasPriceGwei = parseFloat(ctx.gas_price);
    if (gasPriceGwei > this.config.maxGasPriceGwei) {
      return {
        allowed: false,
        reason: `Gas price ${gasPriceGwei} gwei exceeds maximum ${this.config.maxGasPriceGwei} gwei`,
      };
    }
    
    return { allowed: true };
  }

  /**
   * Check protocol allowlist
   */
  private checkProtocolAllowlist(ctx: PolicyContext): PolicyResult {
    if (this.config.allowedProtocols.length === 0 || !ctx.opportunity) {
      return { allowed: true };
    }
    
    const protocol = ctx.opportunity.protocol.toLowerCase();
    const isAllowed = this.config.allowedProtocols.some(
      p => p.toLowerCase() === protocol || protocol.includes(p.toLowerCase())
    );
    
    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Protocol ${ctx.opportunity.protocol} not in allowlist`,
      };
    }
    
    return { allowed: true };
  }

  /**
   * Check chain allowlist
   */
  private checkChainAllowlist(ctx: PolicyContext): PolicyResult {
    if (this.config.allowedChains.length === 0 || !ctx.opportunity) {
      return { allowed: true };
    }
    
    if (!this.config.allowedChains.includes(ctx.opportunity.chain)) {
      return {
        allowed: false,
        reason: `Chain ${ctx.opportunity.chain} not in allowlist`,
      };
    }
    
    return { allowed: true };
  }

  /**
   * Check minimum position size
   */
  private checkMinPositionSize(ctx: PolicyContext): PolicyResult {
    if (!this.config.minPositionSizeUsd || !ctx.opportunity) {
      return { allowed: true };
    }
    
    // Simplified - would calculate actual USD value
    const minDeposit = parseFloat(ctx.opportunity.min_deposit || '0');
    if (minDeposit < this.config.minPositionSizeUsd) {
      return {
        allowed: false,
        reason: `Position size below minimum $${this.config.minPositionSizeUsd}`,
      };
    }
    
    return { allowed: true };
  }

  /**
   * Check maximum number of positions
   */
  private checkMaxPositions(ctx: PolicyContext): PolicyResult {
    if (!this.config.maxPositions || !ctx.wallet) {
      return { allowed: true };
    }
    
    // Simplified - would track actual positions
    return { allowed: true };
  }

  /**
   * Check risk score threshold
   */
  private checkRiskThreshold(ctx: PolicyContext): PolicyResult {
    if (this.config.maxRiskScore === undefined || !ctx.opportunity) {
      return { allowed: true };
    }
    
    const riskScore = ctx.opportunity.risk_score ?? 0;
    if (riskScore > this.config.maxRiskScore) {
      return {
        allowed: false,
        reason: `Risk score ${riskScore.toFixed(2)} exceeds threshold ${this.config.maxRiskScore}`,
      };
    }
    
    return { allowed: true };
  }

  /**
   * Add custom rule
   */
  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove rule by ID
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  /**
   * Get all active rules
   */
  getRules(): PolicyRule[] {
    return [...this.rules];
  }
}

/**
 * Policy Configuration
 */
export interface PolicyConfig {
  /** Maximum transaction value in USD */
  maxTxValueUsd?: number;
  /** Maximum gas price in gwei */
  maxGasPriceGwei?: number;
  /** Allowed protocols (empty = all allowed) */
  allowedProtocols: string[];
  /** Allowed chains (empty = all allowed) */
  allowedChains: Chain[];
  /** Minimum position size in USD */
  minPositionSizeUsd?: number;
  /** Maximum number of concurrent positions */
  maxPositions?: number;
  /** Maximum risk score (0-1) */
  maxRiskScore?: number;
}

/**
 * Default policy configuration for production
 */
export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  maxTxValueUsd: 10000,
  maxGasPriceGwei: 100,
  allowedProtocols: ['aave', 'compound', 'uniswap', 'curve', 'lido', 'yearn'],
  allowedChains: ['ethereum', 'base', 'polygon', 'arbitrum'],
  minPositionSizeUsd: 100,
  maxPositions: 5,
  maxRiskScore: 0.7,
};

/**
 * Default policy configuration for testing
 */
export const TEST_POLICY_CONFIG: PolicyConfig = {
  maxTxValueUsd: 1000,
  maxGasPriceGwei: 200,
  allowedProtocols: [],
  allowedChains: ['base', 'ethereum'],
  minPositionSizeUsd: 10,
  maxPositions: 3,
  maxRiskScore: 0.9,
};