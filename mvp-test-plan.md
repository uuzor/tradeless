# MVP Test Plan - Autonomous DeFi Agent

## Test Overview
- **Scope**: Testnet only (Base, Polygon, Arbitrum)
- **Focus**: Web data quality (TinyFish) + Execution safety (WDK/Protocols)

---

## Layer 1: Web Extraction Tests

| Test Name | Purpose | Expected Result | Owner |
|-----------|---------|-----------------|-------|
| TinyFish_AaveBase_Load | Verify TinyFish can load Aave Base markets page | Page loads, no timeout errors | |
| TinyFish_AaveBase_Extract_APY | Extract APY values from Base lending pools | Returns structured JSON with APY field | |
| TinyFish_AaveBase_Extract_TVL | Extract TVL for each pool | Returns numeric TVL values per asset | |
| TinyFish_AaveBase_Extract_Schema | Validate consistent schema across runs | Same fields returned on repeated runs | |
| TinyFish_UniswapBase_Load | Verify Uniswap Base frontend loads | Swap interface accessible | |
| TinyFish_UniswapBase_Extract_Pool | Extract pool data (token pairs, liquidity) | Returns token pair + liquidity amounts | |
| TinyFish_BaseEcosystem_Dir | Scan Base DeFi directory (defiprime) | Returns list of protocols with URLs | |
| TinyFish_AavePolygon_Load | Verify Aave Polygon markets page loads | Polygon markets accessible | |
| TinyFish_PolygonDEX_FarmPage | Extract farm/yield data from Polygon DEX | Returns APY, reward tokens, TVL | |
| TinyFish_Arbitrum_Load | Verify Aave Arbitrum loads | Arbitrum markets accessible | |
| TinyFish_UniswapArb_Extract | Extract pool data from Arbitrum Uniswap | Token pairs + liquidity on Arb | |
| TinyFish_Camelot_Extract | Extract from Camelot (native Arbitrum) | Returns pool/farm data | |
| TinyFish_Ramses_Extract | Extract from Ramses (native Arbitrum) | Returns pool/farm data | |

### Stability Tests (All Target Pages)
| Test Name | Purpose | Expected Result | Owner |
|-----------|---------|-----------------|-------|
| TinyFish_Stability_AaveBase | Run Aave Base extraction 3x | Same schema each run | |
| TinyFish_Stability_UniswapBase | Run Uniswap Base extraction 3x | Consistent data structure | |
| TinyFish_Stability_RetryLogic | Test retry on page load failure | Recovers after single retry | |

---

## Layer 2: Opportunity Ranking Tests

| Test Name | Purpose | Expected Result | Owner |
|-----------|---------|-----------------|-------|
| Ranking_NetYield_Calculation | Verify scoring uses net yield (APY - gas - fees) | Rejects high-APY with high costs | |
| Ranking_Gas_Inclusion | Include L1 gas + bridge fees in score | Gas costs affect ranking | |
| Ranking_Slippage_Inclusion | Include swap slippage in net yield | Slippage affects ranking | |
| Ranking_Lockup_Penalty | Deduct lockup penalty from score | Locked positions rank lower | |
| Ranking_Rejection_HighAPY_LowNet | Confirm high APY but negative net is rejected | Agent rejects bad deals | |

---

## Layer 3: Wallet & Signing Tests (WDK)

| Test Name | Purpose | Expected Result | Owner |
|-----------|---------|-----------------|-------|
| WDK_Wallet_Create | Create new multi-chain wallet (Base, Polygon, Arb) | Wallet address generated | |
| WDK_Wallet_Unlock | Unlock wallet with private key/signer | Wallet ready for signing | |
| WDK_Balance_Read_Base | Read ETH/ERC20 balance on Base | Returns balance in wei | |
| WDK_Balance_Read_Polygon | Read balance on Polygon | Returns balance in wei | |
| WDK_Balance_Read_Arbitrum | Read balance on Arbitrum | Returns balance in wei | |
| WDK_Tx_Sign_Transfer | Sign a small transfer transaction | Valid signature produced | |
| WDK_Tx_Broadcast_Base | Broadcast signed tx to Base network | Transaction submitted | |
| WDK_Tx_Broadcast_Polygon | Broadcast signed tx to Polygon | Transaction submitted | |
| WDK_Tx_Broadcast_Arbitrum | Broadcast signed tx to Arbitrum | Transaction submitted | |
| WDK_Policy_Check_Reject | Verify policy blocks unauthorized tx | Bad tx rejected | |
| WDK_MultiChain_Signing | Sign for multiple chains in one session | All signatures valid | |

---

## Layer 4: Protocol Execution Tests

### Aave Tests
| Test Name | Purpose | Expected Result | Owner |
|-----------|---------|-----------------|-------|
| Aave_Base_Supply | Supply testnet USDC to Aave Base | Supply tx succeeds, balance updates | |
| Aave_Base_Borrow | Borrow testnet asset after supply | Borrow succeeds within policy | |
| Aave_Polygon_Supply | Supply on Polygon testnet | Supply tx succeeds | |
| Aave_Arbitrum_Supply | Supply on Arbitrum testnet | Supply tx succeeds | |
| Aave_Position_View | Read current positions via agent | Returns supply/borrow amounts | |

### Uniswap Tests
| Test Name | Purpose | Expected Result | Owner |
|-----------|---------|-----------------|-------|
| Uniswap_Base_Quote | Get swap quote on Base | Returns exact output amount | |
| Uniswap_Base_Swap | Execute small swap on Base | Swap completes, balances update | |
| Uniswap_Arb_Quote | Get swap quote on Arbitrum | Returns exact output amount | |
| Uniswap_Arb_Swap | Execute swap on Arbitrum | Swap completes | |
| Uniswap_Route_Selection | Verify route picks best path | Optimal route selected | |
| Uniswap_Slippage_Handling | Test slippage protection | Transaction fails gracefully on high slippage | |

### End-to-End Strategy Test
| Test Name | Purpose | Expected Result | Owner |
|-----------|---------|-----------------|-------|
| E2E_DiscoverToSettle | Full flow: scan → rank → execute | Agent completes one strategy | |

---

## Layer 5: Safety & Failure Tests

| Test Name | Purpose | Expected Result | Owner |
|-----------|---------|-----------------|-------|
| Safety_StaleData_Detection | Handle data >5 min old | Agent flags as stale, retries | |
| Safety_Page_Timeout | Page fails to load in 30s | Agent retries or skips | |
| Safety_Login_Failure | Target requires login | Agent reports auth needed | |
| Safety_BadQuote_Detection | Quote returns invalid amount | Agent rejects quote | |
| Safety_LowLiquidity | Pool has <$1000 liquidity | Agent skips low liquidity pools | |
| Safety_HighGas_Detection | Gas >$50 threshold | Agent rejects due to high cost | |
| Safety_Tx_Revert_Recovery | Transaction reverts on-chain | Agent retries with adjusted params | |
| Safety_Bridge_Blocked | Policy blocks bridge >$1000 | Agent respects policy, doesn't bridge | |
| Safety_Borrow_Blocked | Policy blocks borrow when CR <1.5 | Agent respects policy | |
| Safety_Compound_Blocked | Policy blocks compound when gas high | Agent skips compound | |

---

## Test Scan Order (MVP Phase 1)

### Wave 1 - Core Lending/DEX (6 pages)
1. Aave Base (lending, high signal)
2. Uniswap Base (DEX, high signal)
3. Base ecosystem directory (discovery)
4. Aave Polygon (lending)
5. Aave Arbitrum (lending)
6. Uniswap Arbitrum (DEX)

### Wave 2 - Native Protocols (4 pages)
7. Camelot Arbitrum
8. Ramses Arbitrum
9. Polygon DEX/farm page
10. Polygon bridge page

### Wave 3 - Advanced (if Wave 1-2 stable)
11. Staking dashboards requiring interaction
12. GMX-style trading pages

---

## Acceptance Criteria

### Ready for Production When:
- [ ] Extracts data from all 10 target pages into consistent schema
- [ ] Ranks 3+ opportunities by net yield (not just headline APY)
- [ ] Completes test wallet transaction via WDK
- [ ] Executes one Aave or Uniswap action successfully
- [ ] Recovers from: page failures, stale quotes, transaction reverts
- [ ] Policy layer blocks unauthorized actions

---

## Reference Links

| Resource | URL |
|----------|-----|
| TinyFish Docs | https://docs.tinyfish.ai |
| WDK Docs | https://docs.wdk.tether.io |
| WDK React Native Quickstart | https://docs.wdk.tether.io/start-building/react-native-quickstart |
| WDK Starter | https://docs.wdk.tether.io/examples-and-starters/react-native-starter |
| Aave V3 Overview | https://aave.com/docs/aave-v3/overview |
| Aave V4 Positions/Supply | https://aave.com/docs/aave-v4/positions/supply |
| Uniswap SDK V3 | https://docs.uniswap.org/sdk/v3/overview |
| DefiPrime Base | https://defiprime.com/base |
| QuickNode Base Lending | https://www.quicknode.com/builders-guide/best/top-9-lending-protocols-on-base |
| Polygon Ecosystem | https://coinmarketcap.com/academy/article/what-is-polygon-the-ultimate-guide-to-the-polygon-ecosystem |
| Arbitrum DeFi Ecosystem | https://chronicle.castlecapital.vc/p/arbitrum-defi-ecosystem |