# Zerion AI Trading Agent

Autonomous AI trading agent built on the [Zerion CLI](https://github.com/zeriontech/zerion-ai). Uses XGBoost ML predictions with SHAP explainability to execute real on-chain swaps on Solana, governed by scoped Zerion policies. Interface: Telegram bot.

## Architecture

```
Telegram Bot (Node.js)
    |
    +-- ML Prediction Service (Python FastAPI, port 8002)
    |     +-- XGBoost model (14 features, binary UP/DOWN classifier)
    |     +-- SHAP explanations (top 3 contributing features)
    |     +-- Birdeye OHLCV data (150 x 1m candles for SOL/USDC)
    |
    +-- Zerion CLI (spawned as child process)
    |     +-- Policy enforcement (fail-closed, runs before every tx)
    |     +-- Swap execution via Zerion API (Jupiter routing on Solana)
    |
    +-- Scoped Policies
          +-- solana-lock: restricts trading to Solana chain only
          +-- safe-trading: deny raw transfers + deny approvals + 24h expiry
```

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/predict` | Get ML prediction for SOL/USDC with SHAP explanation |
| `/trade <amount>` | Execute swap based on prediction (UP = buy SOL, DOWN = sell SOL) |
| `/status` | Show wallet portfolio and balances |
| `/policy` | Show active trading policies |
| `/help` | List available commands |

## ML Model

- **Type**: XGBoost binary classifier (UP/DOWN)
- **Features (14)**: RSI, MACD (line/signal/histogram), EMA ratio, volatility, volume spike, momentum, Bollinger position, ADX, ATR, volatility regime, price acceleration, range position
- **Data**: 150 one-minute candles from Birdeye API (SOL/USDC)
- **Explainability**: SHAP TreeExplainer shows top 3 features driving each prediction

## Policies

Two scoped Zerion policies govern all agent activity:

1. **solana-lock** -- Chain restriction. The agent can only operate on Solana. Transactions targeting any other chain are rejected by OWS before signing.

2. **safe-trading** -- Execution constraints:
   - `deny-transfers`: Blocks raw SOL transfers. The agent can only interact with DEX contracts (swap), not send tokens to arbitrary addresses.
   - `deny-approvals`: Blocks unlimited ERC-20/SPL token approvals, preventing token draining attacks.
   - `expires 24h`: Agent token auto-expires after 24 hours, requiring manual renewal.

All policies use fail-closed enforcement: if a policy script fails to load or execute, the transaction is blocked.

## Setup

### Prerequisites
- Node.js 20+
- Python 3.10+
- Zerion API key ([dashboard.zerion.io](https://dashboard.zerion.io))
- Telegram bot token ([@BotFather](https://t.me/BotFather))
- Birdeye API key ([birdeye.so](https://birdeye.so))

### 1. Install dependencies

```bash
npm install
cd ml && pip install -r requirements.txt && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Create wallet

```bash
node cli/zerion.js wallet create --name main
# Save the passphrase securely
```

### 4. Fund wallet

Send SOL (for gas) and USDC to your Solana address:
```bash
node cli/zerion.js wallet fund --wallet main
```

### 5. Create policies and agent token

```bash
./scripts/setup-policies.sh
./scripts/setup-token.sh main
```

### 6. Start services

Terminal 1 -- ML service:
```bash
cd ml && uvicorn server:app --port 8002
```

Terminal 2 -- Telegram bot:
```bash
node bot/index.js
```

### 7. Trade

Open your Telegram bot and send `/predict` to get a signal, then `/trade 1` to execute a $1 swap.

## Project Structure

```
zerion-agent/
  cli/              # Zerion CLI (forked from zeriontech/zerion-ai)
  ml/               # Python ML prediction service
    server.py       # FastAPI endpoints
    prediction.py   # XGBoost inference + SHAP
    indicators.py   # Technical indicator calculations
    data_source.py  # Birdeye/CoinGecko OHLCV fetcher
    models/         # Trained model bundle
  bot/              # Telegram bot (Node.js)
    index.js        # Entry point
    commands.js     # Command handlers
    zerion-bridge.js # CLI subprocess wrapper
    ml-client.js    # ML service HTTP client
    formatter.js    # Telegram message formatting
  scripts/          # Setup automation
```

## License

MIT
