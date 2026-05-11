/**
 * Telegram bot entry point for the Zerion Trading Agent.
 *
 * Commands:
 *   /predict  - Get ML prediction for SOL/USDC
 *   /trade    - Paper trade based on prediction
 *   /status   - Show paper portfolio and P&L
 *   /history  - Show recent trade history
 *   /reset    - Reset portfolio to seed balances
 *   /policy   - Show active trading policies
 *   /help     - Show available commands
 */

import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { getHealth } from "./ml-client.js";
import {
  handlePredict,
  handleTrade,
  handleStatus,
  handleHistory,
  handleReset,
  handlePolicy,
  handleHelp,
} from "./commands.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN not set in environment");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

bot.on("polling_error", (err) => console.error("Polling error:", err.message));

bot.on("message", (msg) => {
  console.log(`Received: "${msg.text}" from ${msg.chat.id}`);
});

bot.onText(/\/start/, (msg) => handleHelp(bot, msg));
bot.onText(/\/help/, (msg) => handleHelp(bot, msg));
bot.onText(/\/predict/, (msg) => handlePredict(bot, msg));
bot.onText(/\/trade(.*)/, (msg, match) => handleTrade(bot, msg, match));
bot.onText(/\/status/, (msg) => handleStatus(bot, msg));
bot.onText(/\/history/, (msg) => handleHistory(bot, msg));
bot.onText(/\/reset/, (msg) => handleReset(bot, msg));
bot.onText(/\/policy/, (msg) => handlePolicy(bot, msg));

try {
  await getHealth();
  console.log("ML service: connected");
} catch {
  console.warn("WARNING: ML service unreachable, /predict will fail");
}

console.log("Zerion Trading Agent bot is running (paper trading mode)...");
