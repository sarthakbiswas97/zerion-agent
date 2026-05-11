# Zerion AI Trading Agent

> Zerion CLI Track Submission -- Autonomous AI trading agent that uses ML predictions to trade SOL/USDC on Solana, governed by scoped Zerion policies. Includes paper trading mode with live market data. Interface: Telegram bot.

## What Is This

A trading agent built on top of the [Zerion CLI](https://github.com/zeriontech/zerion-ai) that combines machine learning with on-chain execution. The agent fetches live SOL/USDC market data, runs an XGBoost classifier to predict price direction, explains its reasoning via SHAP, and trades through the Zerion API -- all within policy guardrails that limit what the agent can do.

The bot operates in **paper trading mode** by default: it uses real live market data from Birdeye, real ML predictions, and real Zerion policy enforcement, but records trades in a local portfolio instead of broadcasting on-chain. When a funded wallet and agent token are configured, the same bot can execute real on-chain swaps with zero code changes.

Users interact through a Telegram bot. No frontend needed -- the bot handles predictions, trade execution, portfolio monitoring, and policy inspection.

## Architecture

```
                         User (Telegram)
                              |
                         Telegram Bot
                        (Node.js ESM)
                              |
              +---------------+---------------+
              |                               |
     ML Prediction Service              Zerion CLI
      (Python FastAPI:8002)          (child process)
              |                               |
   +----------+----------+          +--------+--------+
   |          |          |          |        |        |
 Birdeye   XGBoost    SHAP      Policy   Agent    Swap
  OHLCV    Model    Explainer   Engine   Token   Execution
   API    (14 feat)  (top 3)     |        |        |
              |                  |        |        |
              v                  v        v        v
        Prediction          solana-lock   OWS    Zerion API
        (UP/DOWN +          safe-trading  Sign   (Jupiter
         confidence)        fail-closed          routing)
                                                    |
                                                    v
                                              Solana Blockchain
                                              (real on-chain tx)
```

**Data flow for `/trade`:**
1. Bot receives command from user
2. ML service fetches 150 one-minute candles from Birdeye API
3. Computes 14 technical indicators, normalizes, runs XGBoost inference
4. If confidence exceeds threshold, bot calls Zerion CLI `swap` command
5. CLI enforces policies (chain lock, deny-transfers, deny-approvals, expiry)
6. If all policies pass, OWS signs the transaction using the agent token
7. Zerion API routes the swap through Jupiter on Solana
8. Bot reports tx hash and status back to user

## Judging Criteria Alignment

| Criteria | What We Built |
|----------|---------------|
| **Onchain Functionality** | Full swap pipeline via `zerion swap` (wallet, policies, agent token, execution). Paper trading mode uses real live prices from Birdeye API. With a funded wallet, executes real on-chain swaps on Solana mainnet via Jupiter routing. |
| **Policy Design** | Two scoped Zerion policies: `solana-lock` (chain restriction) and `safe-trading` (deny-transfers + deny-approvals + 24h expiry). Fail-closed enforcement -- any policy failure blocks the tx. |
| **Real-World Applicability** | Solves a real problem: autonomous trading with safety rails. The ML model provides data-driven signals with explainability (SHAP). Policies prevent the agent from draining funds or operating outside its scope. |
| **Code Quality** | Modular architecture: ML service (Python), bot (Node.js), CLI (fork). Clean separation of concerns. No monolith. Each component is independently testable. |
| **Demo Quality** | Telegram bot provides an interactive demo. Send `/predict` for ML analysis, `/trade 10` to paper trade, `/status` for P&L tracking, `/history` for trade log, `/policy` to inspect guardrails. |

## Zerion Integration

This project is a fork of [zeriontech/zerion-ai](https://github.com/zeriontech/zerion-ai). The Zerion CLI is used as-is -- the bot spawns it as a child process and parses its JSON output.

**What we use from Zerion CLI:**

- `zerion wallet create` -- Create an encrypted wallet (EVM + Solana)
- `zerion agent create-policy` -- Define scoped trading policies
- `zerion agent create-token` -- Generate agent token with policies attached
- `zerion swap solana <amount> <from> <to>` -- Execute on-chain swaps
- `zerion portfolio` -- Query wallet balances
- `zerion agent list-policies` -- Inspect active policies

**Agent token flow:**

The agent token is a credential that allows unattended signing. It is bound to a specific wallet and set of policies. The token is passed via `ZERION_AGENT_TOKEN` environment variable -- no interactive passphrase needed at trade time.

```
wallet create --> create-policy --> create-token --> swap (uses token automatically)
```

## ML Prediction Pipeline

The ML service runs as a standalone FastAPI server on port 8002.

**Model:** XGBoost binary classifier trained on historical SOL/USDC data. Predicts UP or DOWN with a confidence score.

**14 Technical Features:**

| Feature | Description | Normalization |
|---------|-------------|---------------|
| RSI | Relative Strength Index (momentum) | /100 |
| MACD | Moving Average Convergence Divergence | /price |
| MACD Signal | MACD signal line | /price |
| MACD Histogram | MACD - Signal | /price |
| EMA Ratio | Price / 20-period EMA | -1 (center) |
| Volatility | Rolling std dev of returns | raw |
| Volume Spike | Current / average volume | -1 (center) |
| Momentum | 10-period rate of change | raw |
| Bollinger Position | Position within Bollinger Bands | -1 to 1 |
| ADX | Average Directional Index (trend strength) | /100 |
| ATR | Average True Range | /price |
| Volatility Regime | Volatility percentile | 0 to 1 |
| Price Acceleration | 2nd derivative of price | x100 |
| Range Position | Position in recent high/low range | -1 to 1 |

**Explainability:** Every prediction includes SHAP values for the top 3 contributing features, showing what drove the decision and in which direction.

**Data source:** Birdeye API (primary) for 1-minute OHLCV candles. CoinGecko (fallback) for hourly candles if Birdeye is unavailable.

## Policy Design

Two Zerion policies created via `zerion agent create-policy`:

### solana-lock

```bash
zerion agent create-policy --name solana-lock --chains solana
```

Restricts the agent to Solana only. Any transaction targeting a different chain is rejected at the OWS level before signing. This prevents misconfiguration or bugs from causing trades on unintended networks.

### safe-trading

```bash
zerion agent create-policy --name safe-trading --deny-transfers --deny-approvals --expires 24h
```

Three constraints in one policy:

- **deny-transfers:** Blocks raw native token transfers. The agent can only interact with DEX contracts (swap), never send tokens to arbitrary addresses. Implemented as an executable policy script that inspects transaction calldata.
- **deny-approvals:** Blocks ERC-20 `approve()` and `increaseAllowance()` calls. Prevents the agent from granting unlimited token spending to contracts.
- **expires 24h:** Agent token auto-expires after 24 hours. Requires manual renewal, limiting the blast radius of a compromised token.

**Enforcement model:** Fail-closed. The policy dispatcher runs all scripts sequentially with AND semantics. If any script fails to load, throws an error, or returns `allow: false`, the transaction is blocked. There is no fallback or bypass.

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/predict` | Fetch live market data, compute features, run ML inference, return prediction with SHAP explanation |
| `/trade <amount>` | Get prediction, check confidence threshold (55%), execute paper trade using live price |
| `/status` | Show paper portfolio balances, total value, and P&L |
| `/history` | Show last 10 trades with timestamps, direction, amounts, and prices |
| `/reset` | Reset portfolio to seed balances (100 USDC + 0.5 SOL) |
| `/policy` | Display active Zerion policies and their rules |
| `/help` | List available commands |

**Trade logic:** If the model predicts UP, the bot buys SOL with USDC. If DOWN, it sells SOL for USDC. Trades below the confidence threshold are skipped unless the user appends `force`.

**Paper trading:** The default mode uses real live prices from Birdeye but records trades locally instead of broadcasting. The portfolio starts with 100 USDC + 0.5 SOL and tracks P&L against the seed value.

## Demo Output

What judges see when interacting with the Telegram bot:

### `/predict` -- ML Prediction with Explanation

```
ML PREDICTION - SOL/USDC

Current Price: $93.12
Direction: UP
Confidence: 68.3% [=======   ]
Suggested Action: BUY SOL with USDC

Why? (SHAP Analysis):
Top 3 features driving this prediction:
    ^ RSI: pushes UP
    ^ EMA Ratio: pushes UP
    v Volume Spike: pushes DOWN

Use /trade <amount> to act on this signal
```

### `/trade 10` -- Paper Trade Execution

```
PAPER TRADE EXECUTED

What happened:
BOUGHT 0.107411 SOL
Paid: 10.00 USDC
Price: $93.10 per SOL

Signal: UP at 68.3% confidence
Trade ID: #3

Wallet After Trade:
    USDC: $90.00
    SOL:  0.607411

This is a paper trade using real live prices.
Use /status to see portfolio P&L
```

### `/status` -- Portfolio and P&L

```
PAPER PORTFOLIO

Current Holdings:
    USDC: $90.00
    SOL:  0.607411

Valuation:
    Current Value: $146.53
    Starting Value: $146.50
    PROFIT: +$0.03 (+0.02%)

Stats:
    Trades Executed: 3
    Active Since: 2026-05-11

Portfolio seeded with 100 USDC + 0.5 SOL
All prices are live from Birdeye API
```

## Going Live: Real On-Chain Mode

Paper trading uses real live prices from Birdeye but records trades in a local JSON file. To switch to real on-chain execution on Solana mainnet, no code changes are needed -- just configure a funded wallet and agent token.

### Steps

1. **Create a wallet:**

```bash
node cli/zerion.js wallet create --name main
```

2. **Fund the wallet** with SOL (for gas) and USDC (for trading). Send tokens to the wallet address shown by:

```bash
node cli/zerion.js portfolio --wallet main
```

3. **Create security policies:**

```bash
./scripts/setup-policies.sh
```

This creates `solana-lock` (chain restriction) and `safe-trading` (deny-transfers, deny-approvals, 24h expiry).

4. **Create an agent token** bound to the wallet and policies:

```bash
./scripts/setup-token.sh main
```

The script reads policy IDs from `zerion agent list-policies`, then runs:

```bash
node cli/zerion.js agent create-token --name main-agent --wallet main --policy <policy-ids>
```

5. **Set the token** in `.env`:

```
ZERION_AGENT_TOKEN=<token from step 4>
```

Once configured, `/trade` executes real swaps on Solana via Jupiter routing. Policies enforce guardrails at the OWS signing layer -- the bot cannot bypass them.

## Quickstart

### Prerequisites

- Node.js 20+, Python 3.10+
- [Zerion API key](https://dashboard.zerion.io)
- [Telegram bot token](https://t.me/BotFather)
- [Birdeye API key](https://birdeye.so)

### Setup

```bash
# Install
npm install
cd ml && pip install -r requirements.txt && cd ..

# Configure
cp .env.example .env
# Fill in ZERION_API_KEY, TELEGRAM_BOT_TOKEN, BIRDEYE_API_KEY

# Create wallet
node cli/zerion.js wallet create --name main

# Fund wallet with SOL (gas) + USDC
node cli/zerion.js wallet fund --wallet main

# Create policies and agent token
./scripts/setup-policies.sh
./scripts/setup-token.sh main

# Start ML service (terminal 1)
cd ml && uvicorn server:app --port 8002

# Start Telegram bot (terminal 2)
node bot/index.js
```

### Test

1. Open your Telegram bot
2. Send `/predict` to see ML analysis
3. Send `/trade 10` to paper trade 10 USDC
4. Send `/status` to see portfolio and P&L
5. Send `/history` to see trade log
6. Send `/policy` to verify guardrails

## Project Structure

```
zerion-agent/
  cli/                   # Zerion CLI (forked, used as subprocess)
  ml/
    server.py            # FastAPI prediction endpoints
    prediction.py        # XGBoost inference + SHAP
    indicators.py        # 14 technical indicator calculations
    data_source.py       # Birdeye/CoinGecko OHLCV fetcher
    models/              # Trained model bundle (.joblib)
  bot/
    index.js             # Telegram bot entry point
    commands.js          # Command handlers (/predict, /trade, /status, /history, /policy)
    paper-portfolio.js   # Paper trading engine with P&L tracking
    zerion-bridge.js     # Spawns Zerion CLI, parses JSON output
    ml-client.js         # HTTP client for ML service
    formatter.js         # Telegram message formatting
  data/
    portfolio.json       # Paper trading state (gitignored)
  scripts/
    setup-policies.sh    # Create Zerion policies
    setup-token.sh       # Create agent token with policies
```

## Tech Stack

- **Zerion CLI** -- Wallet management, policy enforcement, swap execution
- **Python / FastAPI** -- ML prediction service
- **XGBoost + SHAP** -- Classification model with explainability
- **Node.js** -- Telegram bot and CLI bridge
- **Birdeye API** -- Live Solana market data
- **Solana** -- Target blockchain for on-chain swaps

## License

MIT
