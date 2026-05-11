/**
 * Telegram command handlers for the trading agent.
 */

import { getPrediction } from "./ml-client.js";
import { listPolicies } from "./zerion-bridge.js";
import {
  executePaperTrade,
  getPortfolioValue,
  getTrades,
  resetPortfolio,
} from "./paper-portfolio.js";
import {
  formatPrediction,
  formatPaperTrade,
  formatPortfolio,
  formatHistory,
  formatPolicies,
  formatHelp,
} from "./formatter.js";

const CONFIDENCE_THRESHOLD = 0.55;

async function sendMarkdown(bot, chatId, text) {
  try {
    await bot.sendMessage(chatId, text, { parse_mode: "MarkdownV2" });
  } catch {
    await bot.sendMessage(chatId, text.replace(/[\\*_`[\]()~>#+\-=|{}.!]/g, ""));
  }
}

export async function handlePredict(bot, msg) {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "Fetching prediction...");

  try {
    const prediction = await getPrediction();
    await sendMarkdown(bot, chatId, formatPrediction(prediction));
  } catch (err) {
    await bot.sendMessage(chatId, `Prediction failed: ${err.message}`);
  }
}

export async function handleTrade(bot, msg, match) {
  const chatId = msg.chat.id;
  const rawInput = match?.[1]?.trim() || "";
  const parts = rawInput.split(/\s+/);
  const amountStr = parts[0];
  const hasForce = parts.includes("force");

  if (!amountStr || isNaN(parseFloat(amountStr))) {
    await bot.sendMessage(chatId, "Usage: /trade <amount>\nExample: /trade 10");
    return;
  }

  const amount = parseFloat(amountStr);

  await bot.sendMessage(chatId, "Getting prediction...");

  let prediction;
  try {
    prediction = await getPrediction();
  } catch (err) {
    await bot.sendMessage(chatId, `Cannot get prediction: ${err.message}`);
    return;
  }

  if (prediction.confidence < CONFIDENCE_THRESHOLD && !hasForce) {
    await bot.sendMessage(
      chatId,
      `Low confidence: ${(prediction.confidence * 100).toFixed(1)}% (threshold: ${CONFIDENCE_THRESHOLD * 100}%)\n` +
      `Direction: ${prediction.direction}\n` +
      `Trade skipped. Use /trade ${amountStr} force to override.`
    );
    return;
  }

  const result = executePaperTrade({
    direction: prediction.direction,
    confidence: prediction.confidence,
    amount,
    price: prediction.price,
  });

  if (!result.success) {
    await bot.sendMessage(chatId, `Trade failed: ${result.error}`);
    return;
  }

  await sendMarkdown(bot, chatId, formatPaperTrade(result.trade, result.balances));
}

export async function handleStatus(bot, msg) {
  const chatId = msg.chat.id;

  try {
    const prediction = await getPrediction();
    const data = getPortfolioValue(prediction.price);
    await sendMarkdown(bot, chatId, formatPortfolio(data));
  } catch (err) {
    await bot.sendMessage(chatId, `Status failed: ${err.message}`);
  }
}

export async function handleHistory(bot, msg) {
  const chatId = msg.chat.id;
  const trades = getTrades().slice(-10).reverse();
  await sendMarkdown(bot, chatId, formatHistory(trades));
}

export async function handleReset(bot, msg) {
  const chatId = msg.chat.id;
  const balances = resetPortfolio();
  await bot.sendMessage(
    chatId,
    `Portfolio reset to seed balances:\nUSDC: ${balances.USDC}\nSOL: ${balances.SOL}`
  );
}

export async function handlePolicy(bot, msg) {
  const chatId = msg.chat.id;

  try {
    const data = await listPolicies();
    await sendMarkdown(bot, chatId, formatPolicies(data));
  } catch (err) {
    await bot.sendMessage(chatId, `Policy fetch failed: ${err.message}`);
  }
}

export async function handleHelp(bot, msg) {
  await sendMarkdown(bot, msg.chat.id, formatHelp());
}
