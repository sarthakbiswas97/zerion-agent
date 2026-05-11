/**
 * Paper trading portfolio tracker.
 * Persists virtual balances and trade history to a local JSON file.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = resolve(__dirname, "..", "data", "portfolio.json");

const SEED_BALANCES = { USDC: 100, SOL: 0.5 };

function loadPortfolio() {
  if (!existsSync(DATA_PATH)) return createSeedPortfolio();
  try {
    return JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  } catch {
    return createSeedPortfolio();
  }
}

function createSeedPortfolio() {
  const portfolio = {
    balances: { ...SEED_BALANCES },
    trades: [],
    createdAt: new Date().toISOString(),
  };
  save(portfolio);
  return portfolio;
}

function save(portfolio) {
  writeFileSync(DATA_PATH, JSON.stringify(portfolio, null, 2));
}

export function getBalances() {
  return loadPortfolio().balances;
}

export function getTrades() {
  return loadPortfolio().trades;
}

export function getPortfolioValue(livePrice) {
  const { balances, trades, createdAt } = loadPortfolio();
  const solValue = (balances.SOL || 0) * livePrice;
  const usdcValue = balances.USDC || 0;
  const currentValue = solValue + usdcValue;

  const seedValue = SEED_BALANCES.USDC + SEED_BALANCES.SOL * livePrice;
  const pnl = currentValue - seedValue;
  const pnlPercent = seedValue > 0 ? (pnl / seedValue) * 100 : 0;

  return {
    balances,
    currentValue: round(currentValue),
    seedValue: round(seedValue),
    pnl: round(pnl),
    pnlPercent: round(pnlPercent),
    tradeCount: trades.length,
    createdAt,
  };
}

export function executePaperTrade({ direction, confidence, amount, price }) {
  const portfolio = loadPortfolio();
  const { balances } = portfolio;

  const isBuy = direction === "UP";
  const fromToken = isBuy ? "USDC" : "SOL";
  const toToken = isBuy ? "SOL" : "USDC";

  const fromBalance = balances[fromToken] || 0;
  if (fromBalance < amount) {
    return {
      success: false,
      error: `Insufficient ${fromToken} balance: have ${round(fromBalance)}, need ${amount}`,
    };
  }

  const toAmount = isBuy ? amount / price : amount * price;

  balances[fromToken] = round(fromBalance - amount);
  balances[toToken] = round((balances[toToken] || 0) + toAmount);

  const trade = {
    id: portfolio.trades.length + 1,
    timestamp: new Date().toISOString(),
    direction,
    confidence: round(confidence),
    from: fromToken,
    fromAmount: round(amount),
    to: toToken,
    toAmount: round(toAmount),
    price: round(price),
  };

  portfolio.trades.push(trade);
  save(portfolio);

  return { success: true, trade, balances };
}

export function resetPortfolio() {
  const portfolio = createSeedPortfolio();
  return portfolio.balances;
}

function round(n) {
  return Math.round(n * 1e6) / 1e6;
}
