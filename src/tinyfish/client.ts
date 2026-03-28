/**
 * TinyFish Web Automation Client
 * AI-powered web automation that turns natural language into browser actions
 */

import { EventEmitter } from 'events';
import { 
  TinyFishAutomationRequest, 
  TinyFishAutomationResult, 
  TinyFishEvent, 
  BrowserProfile,
  ProxyConfig,
  ScanTarget
} from '../types';

const TINYFISH_BASE_URL = 'https://agent.tinyfish.ai';
const TIMEOUT_MS = 60000;

export interface TinyFishConfig {
  apiKey: string;
  browserProfile?: BrowserProfile;
  proxyConfig?: ProxyConfig;
}

export class TinyFishClient extends EventEmitter {
  private apiKey: string;
  private browserProfile: BrowserProfile;
  private proxyConfig?: ProxyConfig;

  constructor(config: TinyFishConfig) {
    super();
    this.apiKey = config.apiKey;
    this.browserProfile = config.browserProfile || 'stealth';
    this.proxyConfig = config.proxyConfig;
  }

  /**
   * Run an automation task with SSE streaming
   * @param url - Target website URL
   * @param goal - Natural language description of what to accomplish
   */
  async runAutomation(url: string, goal: string): Promise<TinyFishAutomationResult> {
    const request: TinyFishAutomationRequest = {
      url,
      goal,
      browser_profile: this.browserProfile,
      proxy_config: this.proxyConfig
    };

    return this.runSSEAutomation(request);
  }

  /**
   * Run automation from a ScanTarget
   */
  async runScanTarget(target: ScanTarget): Promise<TinyFishAutomationResult> {
    return this.runAutomation(target.url, target.goal);
  }

  /**
   * Execute SSE-based automation with streaming events
   */
  private async runSSEAutomation(request: TinyFishAutomationRequest): Promise<TinyFishAutomationResult> {
    const events: TinyFishEvent[] = [];
    let runId = '';
    let streamingUrl = '';

    const requestBody = JSON.stringify(request);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${TINYFISH_BASE_URL}/v1/automation/run-sse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: requestBody,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`TinyFish API error: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const event = JSON.parse(data) as TinyFishEvent;
              event.timestamp = Date.now();
              events.push(event);
              this.emit('event', event);

              switch (event.type) {
                case 'STARTED':
                  runId = event.run_id || '';
                  break;
                case 'STREAMING_URL':
                  streamingUrl = event.streaming_url || '';
                  break;
                case 'COMPLETE':
                  clearTimeout(timeoutId);
                  return {
                    run_id: runId,
                    status: event.status || 'COMPLETED',
                    streaming_url: streamingUrl,
                    events,
                    extracted_data: event.data
                  };
                case 'ERROR':
                  clearTimeout(timeoutId);
                  return {
                    run_id: runId,
                    status: 'FAILED',
                    events,
                    error: String(event.data)
                  };
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }

      clearTimeout(timeoutId);
      return {
        run_id: runId,
        status: 'COMPLETED',
        streaming_url: streamingUrl,
        events
      };
    } catch (error) {
      clearTimeout(timeoutId);
      return {
        run_id: runId,
        status: 'FAILED',
        events,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Scan multiple targets concurrently
   */
  async scanMultiple(targets: ScanTarget[]): Promise<Map<string, TinyFishAutomationResult>> {
    const results = new Map<string, TinyFishAutomationResult>();
    
    const promises = targets.map(async (target) => {
      try {
        const result = await this.runScanTarget(target);
        results.set(target.id, result);
        return { target, result };
      } catch (error) {
        results.set(target.id, {
          run_id: '',
          status: 'FAILED',
          events: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return { target, error };
      }
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Set browser profile
   */
  setBrowserProfile(profile: BrowserProfile): void {
    this.browserProfile = profile;
  }

  /**
   * Set proxy configuration
   */
  setProxyConfig(config: ProxyConfig): void {
    this.proxyConfig = config;
  }
}

/**
 * Predefined scan targets for MVP
 */
export const MVP_SCAN_TARGETS: ScanTarget[] = [
  // Wave 1 - Core Lending/DEX
  {
    id: 'aave_base',
    url: 'https://app.aave.com/',
    goal: 'Find all available lending pools on Base with their supply APY, borrow rate, and TVL. Extract asset name, APY percentage, and liquidity amount.',
    chain: 'base',
    protocol: 'aave',
    priority: 1
  },
  {
    id: 'uniswap_base',
    url: 'https://app.uniswap.org/explore/pools/base',
    goal: 'Extract all visible token pools on Base with their liquidity amounts and token pair symbols.',
    chain: 'base',
    protocol: 'uniswap',
    priority: 2
  },
  {
    id: 'base_ecosystem',
    url: 'https://defiprime.com/base',
    goal: 'List all DeFi protocols on Base with their website URLs and categories.',
    chain: 'base',
    protocol: 'directory',
    priority: 3
  },
  {
    id: 'aave_polygon',
    url: 'https://app.aave.com/markets/?market=polygon',
    goal: 'Find all available lending pools on Polygon with their supply APY, borrow rate, and TVL.',
    chain: 'polygon',
    protocol: 'aave',
    priority: 4
  },
  {
    id: 'aave_arbitrum',
    url: 'https://app.aave.com/markets/?market=arbitrum',
    goal: 'Find all available lending pools on Arbitrum with their supply APY, borrow rate, and TVL.',
    chain: 'arbitrum',
    protocol: 'aave',
    priority: 5
  },
  {
    id: 'uniswap_arbitrum',
    url: 'https://app.uniswap.org/explore/pools/arbitrum',
    goal: 'Extract all visible token pools on Arbitrum with their liquidity amounts and token pair symbols.',
    chain: 'arbitrum',
    protocol: 'uniswap',
    priority: 6
  },
  // Wave 2 - Native Protocols
  {
    id: 'camelot_arbitrum',
    url: 'https://app.camelot.exchange/pools',
    goal: 'Extract all liquidity pools on Camelot with token pairs, APY, and TVL.',
    chain: 'arbitrum',
    protocol: 'camelot',
    priority: 7
  },
  {
    id: 'ramses_arbitrum',
    url: 'https://app.ramses.exchange/pools',
    goal: 'Extract all liquidity pools on Ramses with token pairs, APY, and TVL.',
    chain: 'arbitrum',
    protocol: 'ramses',
    priority: 8
  },
  {
    id: 'polygon_dex',
    url: 'https://app.quickswap.exchange/pools',
    goal: 'Extract all visible pools on QuickSwap with liquidity and token pairs.',
    chain: 'polygon',
    protocol: 'quickswap',
    priority: 9
  }
];

export default TinyFishClient;