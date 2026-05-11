/**
 * Telegram bot entry point for the Zerion Trading Agent.
 *
 * Commands:
 *   /predict - Get ML prediction for SOL/USDC
 *   /trade <amount> - Execute swap based on prediction
 *   /status  - Show wallet portfolio
 *   /policy  - Show active trading policies
 *   /help    - Show available commands
 */

import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { handlePredict, handleTrade, handleStatus, handlePolicy, handleHelp } from "./commands.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN not set in environment");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/predict/, (msg) => handlePredict(bot, msg));
bot.onText(/\/trade(.*)/, (msg, match) => handleTrade(bot, msg, match));
bot.onText(/\/status/, (msg) => handleStatus(bot, msg));
bot.onText(/\/policy/, (msg) => handlePolicy(bot, msg));
bot.onText(/\/help/, (msg) => handleHelp(bot, msg));
bot.onText(/\/start/, (msg) => handleHelp(bot, msg));

console.log("Zerion Trading Agent bot is running...");
