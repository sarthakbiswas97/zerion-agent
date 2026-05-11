/**
 * Telegram message formatting utilities (Markdown V2).
 * Designed for hackathon demo -- messages should be self-explanatory to judges.
 */

function escMd(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

function fmtNum(n, decimals = 2) {
  return Number(n).toFixed(decimals);
}

function fmtUsd(n) {
  return `\\$${escMd(fmtNum(n))}`;
}

function confidenceBar(pct) {
  const filled = Math.round(pct / 10);
  return escMd("[" + "=".repeat(filled) + " ".repeat(10 - filled) + "]");
}

export function formatPrediction(pred) {
  const pct = fmtNum(pred.confidence * 100, 1);
  const bar = confidenceBar(pred.confidence * 100);
  const action = pred.direction === "UP" ? "BUY SOL with USDC" : "SELL SOL for USDC";

  const shapLines = Object.entries(pred.shap_explanation || {})
    .map(([name, info]) => {
      const arrow = info.direction === "pushes UP" ? "^" : "v";
      return `    ${escMd(arrow)} ${escMd(name)}: ${escMd(info.direction)}`;
    })
    .join("\n");

  return [
    `*ML PREDICTION \\- SOL/USDC*`,
    ``,
    `*Current Price:* ${fmtUsd(pred.price)}`,
    `*Direction:* ${escMd(pred.direction)}`,
    `*Confidence:* ${escMd(pct)}% ${bar}`,
    `*Suggested Action:* ${escMd(action)}`,
    ``,
    `*Why? \\(SHAP Analysis\\):*`,
    `_Top 3 features driving this prediction:_`,
    shapLines,
    ``,
    `_Use /trade <amount> to act on this signal_`,
  ].join("\n");
}

export function formatPaperTrade(trade, balances) {
  const action = trade.direction === "UP" ? "BOUGHT" : "SOLD";
  const pct = fmtNum(trade.confidence * 100, 1);

  return [
    `*PAPER TRADE EXECUTED*`,
    ``,
    `*What happened:*`,
    `${escMd(action)} ${escMd(fmtNum(trade.toAmount, 6))} ${escMd(trade.to)}`,
    `Paid: ${escMd(fmtNum(trade.fromAmount, 2))} ${escMd(trade.from)}`,
    `Price: ${fmtUsd(trade.price)} per SOL`,
    ``,
    `*Signal:* ${escMd(trade.direction)} at ${escMd(pct)}% confidence`,
    `*Trade ID:* \\#${escMd(trade.id)}`,
    ``,
    `*Wallet After Trade:*`,
    `    USDC: ${fmtUsd(balances.USDC)}`,
    `    SOL:  ${escMd(fmtNum(balances.SOL, 6))}`,
    ``,
    `_This is a paper trade using real live prices\\._`,
    `_Use /status to see portfolio P&L_`,
  ].join("\n");
}

export function formatPortfolio(data) {
  const pnlSign = data.pnl >= 0 ? "+" : "";
  const pnlLabel = data.pnl >= 0 ? "PROFIT" : "LOSS";

  return [
    `*PAPER PORTFOLIO*`,
    ``,
    `*Current Holdings:*`,
    `    USDC: ${fmtUsd(data.balances.USDC)}`,
    `    SOL:  ${escMd(fmtNum(data.balances.SOL, 6))}`,
    ``,
    `*Valuation:*`,
    `    Current Value: ${fmtUsd(data.currentValue)}`,
    `    Starting Value: ${fmtUsd(data.seedValue)}`,
    `    ${escMd(pnlLabel)}: ${escMd(pnlSign)}${fmtUsd(Math.abs(data.pnl))} \\(${escMd(pnlSign)}${escMd(fmtNum(data.pnlPercent, 2))}%\\)`,
    ``,
    `*Stats:*`,
    `    Trades Executed: ${escMd(data.tradeCount)}`,
    `    Active Since: ${escMd(data.createdAt?.split("T")[0] || "unknown")}`,
    ``,
    `_Portfolio seeded with 100 USDC \\+ 0\\.5 SOL_`,
    `_All prices are live from Birdeye API_`,
  ].join("\n");
}

export function formatHistory(trades) {
  if (!trades.length) {
    return [
      `*TRADE HISTORY*`,
      ``,
      `No trades yet\\.`,
      `_Use /predict to get a signal, then /trade <amount> to act_`,
    ].join("\n");
  }

  const lines = [`*TRADE HISTORY \\(last ${escMd(trades.length)}\\)*`, ``];

  for (const t of trades) {
    const time = t.timestamp?.split("T")[1]?.slice(0, 5) || "";
    const action = t.direction === "UP" ? "BUY " : "SELL";
    const conf = fmtNum(t.confidence * 100, 0);
    lines.push(
      `\\#${escMd(t.id)} \\[${escMd(time)}\\] ${escMd(action)} ` +
      `${escMd(fmtNum(t.fromAmount, 2))} ${escMd(t.from)} \\-\\> ` +
      `${escMd(fmtNum(t.toAmount, 4))} ${escMd(t.to)} ` +
      `@ ${fmtUsd(t.price)} \\(${escMd(conf)}%\\)`
    );
  }

  lines.push(``);
  lines.push(`_Use /status to see current portfolio value_`);

  return lines.join("\n");
}

export function formatPolicies(data) {
  const policies = data.policies || data || [];

  if (!Array.isArray(policies) || policies.length === 0) {
    return [
      `*ZERION POLICIES*`,
      ``,
      `No policies configured\\.`,
      `_Run setup\\-policies\\.sh to create them_`,
    ].join("\n");
  }

  const lines = [
    `*ZERION POLICIES*`,
    `_These govern what the agent is allowed to do:_`,
    ``,
  ];

  for (const policy of policies) {
    lines.push(`*${escMd(policy.name || policy.id)}*`);

    const rules = policy.rules || [];
    for (const rule of rules) {
      if (rule.type === "allowed_chains") {
        const chains = (rule.chain_ids || []).join(", ");
        lines.push(`    Chain Lock: ${escMd(chains)}`);
      } else if (rule.type === "expires_at") {
        lines.push(`    Expires: ${escMd(rule.timestamp)}`);
      }
    }

    if (policy.config?.scripts) {
      const scripts = (policy.config.scripts || [])
        .map((s) => s.split("/").pop().replace(".mjs", ""))
        .join(", ");
      lines.push(`    Guards: ${escMd(scripts)}`);
    }

    lines.push(``);
  }

  lines.push(`_Policies use fail\\-closed enforcement:_`);
  lines.push(`_If ANY check fails, the transaction is blocked_`);

  return lines.join("\n");
}

export function formatHelp() {
  return [
    `*ZERION AI TRADING AGENT*`,
    `_Autonomous SOL/USDC trader with ML predictions_`,
    ``,
    `*How it works:*`,
    `1\\. ML model analyzes 14 technical indicators from live market data`,
    `2\\. Predicts SOL price direction \\(UP/DOWN\\) with confidence score`,
    `3\\. SHAP explains which factors drove the prediction`,
    `4\\. Executes paper trades using real\\-time Birdeye prices`,
    `5\\. Zerion policies enforce trading guardrails`,
    ``,
    `*Commands:*`,
    `/predict  \\- Get ML prediction with explanation`,
    `/trade 10 \\- Paper trade 10 USDC based on signal`,
    `/status   \\- View portfolio, P&L, and holdings`,
    `/history  \\- View recent trade log`,
    `/reset    \\- Reset to starting balance`,
    `/policy   \\- View Zerion security policies`,
    ``,
    `*Stack:* XGBoost \\+ SHAP \\| Birdeye API \\| Zerion CLI \\| Solana`,
  ].join("\n");
}
