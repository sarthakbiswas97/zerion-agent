/**
 * Telegram command handlers for the trading agent.
 */

import { getPrediction, getHealth } from "./ml-client.js";
import { executeSwap, getPortfolio, listPolicies } from "./zerion-bridge.js";
import {
  formatPrediction,
  formatTrade,
  formatPortfolio,
  formatPolicies,
  formatHelp,
} from "./formatter.js";

const CONFIDENCE_THRESHOLD = 0.55;
const DEFAULT_CHAIN = "solana";

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
  const rawAmount = match?.[1]?.trim();

  if (!rawAmount || isNaN(parseFloat(rawAmount))) {
    await bot.sendMessage(chatId, "Usage: /trade <amount>\nExample: /trade 1");
    return;
  }

  const amount = parseFloat(rawAmount);

  await bot.sendMessage(chatId, "Getting prediction and preparing trade...");

  let prediction;
  try {
    prediction = await getPrediction();
  } catch (err) {
    await bot.sendMessage(chatId, `Cannot get prediction: ${err.message}`);
    return;
  }

  if (prediction.confidence < CONFIDENCE_THRESHOLD) {
    await bot.sendMessage(
      chatId,
      `Low confidence: ${(prediction.confidence * 100).toFixed(1)}% (threshold: ${CONFIDENCE_THRESHOLD * 100}%)\n` +
      `Direction: ${prediction.direction}\n` +
      `Trade skipped. Use /trade ${rawAmount} force to override.`
    );

    if (!rawAmount.includes("force")) return;
  }

  const isUp = prediction.direction === "UP";
  const fromToken = isUp ? "USDC" : "SOL";
  const toToken = isUp ? "SOL" : "USDC";

  await bot.sendMessage(
    chatId,
    `Executing: ${amount} ${fromToken} -> ${toToken} on ${DEFAULT_CHAIN}...`
  );

  try {
    const result = await executeSwap(DEFAULT_CHAIN, amount, fromToken, toToken);
    await sendMarkdown(bot, chatId, formatTrade(prediction, result));
  } catch (err) {
    await bot.sendMessage(chatId, `Trade failed: ${err.message}`);
  }
}

export async function handleStatus(bot, msg) {
  const chatId = msg.chat.id;

  try {
    const data = await getPortfolio();
    await sendMarkdown(bot, chatId, formatPortfolio(data));
  } catch (err) {
    await bot.sendMessage(chatId, `Portfolio fetch failed: ${err.message}`);
  }
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
