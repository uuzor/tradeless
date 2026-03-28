/**
 * Core type definitions for the Autonomous DeFi Agent
 */

// Supported chains for the MVP
export type Chain = 'base' | 'polygon' | 'arbitrum' | 'ethereum';

// Protocol types
export type ProtocolType = 'lending' | 'lp' | 'staking' | 'bridge' | 'vault' | 'aggregator' | 'other';

// Browser profile types for TinyFish
export type BrowserProfile = 'lite' | 'stealth';

// TinyFish SSE Event types
export type TinyFishEventType = 'STARTED' | 'STREAMING_URL' | 'PROGRESS' | 'COMPLETE' | 'HEARTBEAT' | 'ERROR';

// TinyFish event payload
export interface TinyFishEvent {
  type: TinyFishEventType;
  run_id?: string;
  streaming_url?: string;
  purpose?: string;
  status?: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  data?: unknown;
  timestamp: number;
}

// TinyFish automation request
export interface TinyFishAutomationRequest {
  url: string;
  goal: string;
  browser_profile?: BrowserProfile;
  proxy_config?: ProxyConfig;
  use_vault?: boolean;
  credential_item_ids?: string[];
}

// Proxy configuration
export interface ProxyConfig {
  enabled: boolean;
  country?: 'US' | 'GB' | 'CA' | 'DE' | 'FR' | 'JP' | 'AU';
}

// TinyFish automation result
export interface TinyFishAutomationResult {
  run_id: string;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  streaming_url?: string;
  events: TinyFishEvent[];
  extracted_data?: unknown;
  error?: string;
}

// DeFi yield opportunity
export interface YieldOpportunity {
  id: string;
  protocol: string;
  chain: Chain;
  type?: ProtocolType;
  token: string;
  asset?: string;
  apy: number; // Annual Percentage Yield
  tvl: number; // Total Value Locked
  risk_score?: number;
  min_deposit?: string;
  max_deposit?: string;
  url?: string;
  reward_token?: string;
  reward_apy?: number;
  lockup_period_days?: number;
  fees?: {
    deposit_fee?: number;
    withdrawal_fee?: number;
    performance_fee?: number;
  };
  source_url?: string;
  last_updated?: number;
}

// Net yield calculation
export interface NetYieldCalculation {
  opportunity: YieldOpportunity;
  gross_apy: number;
  gas_cost_estimate: number;
  bridge_cost_estimate: number;
  slippage_estimate: number;
  lockup_penalty: number;
  net_apy: number;
  is_viable: boolean;
  rejection_reason?: string;
}

// Wallet types
export interface WalletConfig {
  chains: Chain[];
  private_key?: string;
  mnemonic?: string;
}

export interface WalletState {
  address: string;
  chain?: Chain; // Single chain for convenience
  chains: Chain[];
  balance?: string; // Single balance for convenience
  balances?: Partial<Record<Chain, string>>; // wei amounts - partial allows optional
  nonce?: number;
  is_unlocked: boolean;
  isLocked?: boolean; // Alternative field
}

// Transaction request
export interface TransactionRequest {
  chain: Chain;
  to: string;
  value?: string;
  data?: string;
  gas_limit?: string;
  gas_limit_hex?: string;
  gas_price?: string;
  gasLimit?: string; // Alternative field name
  nonce?: number;
  max_fee_per_gas?: string;
  max_priority_fee_per_gas?: string;
}

export interface TransactionResult {
  chain: Chain;
  tx_hash?: string;
  hash?: string; // Alternative field name
  from?: string;
  to?: string;
  value?: string;
  status: 'pending' | 'confirmed' | 'failed';
  block_number?: number;
  blockNumber?: number; // Alternative field name
  timestamp?: number;
  gas_used?: string;
  gasUsed?: string; // Alternative field name
  gas_price?: string;
  error?: string;
}

// Protocol action types
export type ProtocolAction = 
  | 'supply'
  | 'borrow'
  | 'withdraw'
  | 'repay'
  | 'swap'
  | 'stake'
  | 'unstake'
  | 'bridge';

// Aave-specific types
export interface AavePosition {
  chain: Chain;
  supply_balance: string;
  borrow_balance: string;
  collateral_enabled: boolean;
  health_factor?: string;
}

export interface AaveMarket {
  chain: Chain;
  asset: string;
  aToken_address: string;
  stable_borrow_rate?: number;
  variable_borrow_rate: number;
  liquidity: string;
  utilization: number;
  supply_apy: number;
  borrow_apy: number;
  is_collateral: boolean;
}

// Uniswap-specific types
export interface UniswapPool {
  chain: Chain;
  token0: string;
  token1: string;
  fee_tier: number;
  liquidity: string;
  token0_price: string;
  token1_price: string;
}

export interface UniswapQuote {
  input_amount: string;
  output_amount: string;
  path: string[];
  slippage: number;
  gas_estimate: string;
}

// Policy/Safety types
export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  check: (context: PolicyContext) => PolicyResult;
}

export interface PolicyContext {
  action: ProtocolAction;
  opportunity?: YieldOpportunity;
  wallet: WalletState;
  gas_price?: string;
  tx_value?: string;
}

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
  adjusted_value?: string;
}

// Strategy types
export interface StrategyConfig {
  max_gas_price_gwei: number;
  max_bridge_amount_usd: number;
  min_collateral_ratio: number;
  max_leverage: number;
  rebalance_threshold: number;
  scan_interval_ms: number;
}

export interface StrategyDecision {
  action: ProtocolAction;
  protocol: string;
  chain: Chain;
  amount: string;
  asset?: string;
  token?: string;
  expected_apy: number;
  risk_score?: number;
  reasoning?: string;
  reason?: string;
}

// Scan target definition
export interface ScanTarget {
  id: string;
  url: string;
  goal: string;
  chain: Chain;
  protocol: string;
  priority: number;
}

// Agent state
export interface AgentState {
  running: boolean;
  last_scan: number;
  opportunities: YieldOpportunity[];
  wallet: WalletState | null;
  current_strategy: StrategyDecision | null;
  errors: string[];
}