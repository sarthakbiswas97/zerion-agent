/**
 * Telegram message formatting utilities (Markdown V2).
 */

function escMd(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

function fmtNum(n, decimals = 2) {
  return Number(n).toFixed(decimals);
}

export function formatPrediction(pred) {
  const pct = fmtNum(pred.confidence * 100, 1);

  const shapLines = Object.entries(pred.shap_explanation || {})
    .map(([name, info]) => `  ${escMd(name)}: ${escMd(info.direction)} \\(${escMd(info.value)}\\)`)
    .join("\n");

  return [
    `*SOL/USDC Prediction*`,
    ``,
    `Direction: *${escMd(pred.direction)}*`,
    `Confidence: *${escMd(pct)}%*`,
    `Price: \\$${escMd(fmtNum(pred.price))}`,
    ``,
    `*Key Factors:*`,
    shapLines,
  ].join("\n");
}

export function formatPaperTrade(trade, balances) {
  return [
    `*Paper Trade Executed*`,
    ``,
    `Signal: *${escMd(trade.direction)}* \\(${escMd(fmtNum(trade.confidence * 100, 1))}%\\)`,
    `Swap: ${escMd(fmtNum(trade.fromAmount, 4))} ${escMd(trade.from)} \\-\\> ${escMd(fmtNum(trade.toAmount, 4))} ${escMd(trade.to)}`,
    `Price: \\$${escMd(fmtNum(trade.price))}`,
    `Trade \\#${escMd(trade.id)}`,
    ``,
    `*Updated Balances:*`,
    `  USDC: ${escMd(fmtNum(balances.USDC, 2))}`,
    `  SOL: ${escMd(fmtNum(balances.SOL, 6))}`,
  ].join("\n");
}

export function formatPortfolio(data) {
  const pnlSign = data.pnl >= 0 ? "\\+" : "";

  return [
    `*Paper Portfolio*`,
    ``,
    `*Balances:*`,
    `  USDC: ${escMd(fmtNum(data.balances.USDC, 2))}`,
    `  SOL: ${escMd(fmtNum(data.balances.SOL, 6))}`,
    ``,
    `Total Value: *\\$${escMd(fmtNum(data.currentValue))}*`,
    `Seed Value: \\$${escMd(fmtNum(data.seedValue))}`,
    `P&L: ${pnlSign}${escMd(fmtNum(data.pnl))} \\(${pnlSign}${escMd(fmtNum(data.pnlPercent, 2))}%\\)`,
    ``,
    `Trades: ${escMd(data.tradeCount)}`,
    `Since: ${escMd(data.createdAt?.split("T")[0] || "unknown")}`,
  ].join("\n");
}

export function formatHistory(trades) {
  if (!trades.length) {
    return `*Trade History*\n\nNo trades yet\\. Use /trade <amount> to start\\.`;
  }

  const lines = [`*Trade History* \\(last ${escMd(trades.length)}\\)`, ``];

  for (const t of trades) {
    const time = t.timestamp?.split("T")[1]?.slice(0, 8) || "";
    const conf = fmtNum(t.confidence * 100, 0);
    lines.push(
      `\\#${escMd(t.id)} ${escMd(time)} *${escMd(t.direction)}* ${escMd(conf)}% ` +
      `${escMd(fmtNum(t.fromAmount, 2))} ${escMd(t.from)} \\-\\> ${escMd(fmtNum(t.toAmount, 4))} ${escMd(t.to)} ` +
      `@\\$${escMd(fmtNum(t.price))}`
    );
  }

  return lines.join("\n");
}

export function formatPolicies(data) {
  const policies = data.policies || data || [];

  if (!Array.isArray(policies) || policies.length === 0) {
    return `*Active Policies*\n\nNo policies configured\\.`;
  }

  const lines = [`*Active Policies*`, ``];

  for (const policy of policies) {
    lines.push(`*${escMd(policy.name || policy.id)}*`);

    const rules = policy.rules || [];
    for (const rule of rules) {
      if (rule.type === "allowed_chains") {
        const chains = (rule.chain_ids || []).join(", ");
        lines.push(`  Chains: ${escMd(chains)}`);
      } else if (rule.type === "expires_at") {
        lines.push(`  Expires: ${escMd(rule.timestamp)}`);
      }
    }

    if (policy.executable || policy.config?.scripts) {
      const scripts = (policy.config?.scripts || [])
        .map((s) => s.split("/").pop().replace(".mjs", ""))
        .join(", ");
      lines.push(`  Scripts: ${escMd(scripts)}`);
    }

    lines.push(``);
  }

  return lines.join("\n");
}

export function formatHelp() {
  return [
    `*Zerion Trading Agent \\(Paper Mode\\)*`,
    ``,
    `/predict \\- Get ML prediction for SOL/USDC`,
    `/trade <amount> \\- Paper trade based on prediction`,
    `/status \\- Show paper portfolio and P&L`,
    `/history \\- Show recent trade history`,
    `/reset \\- Reset portfolio to seed balances`,
    `/policy \\- Show active trading policies`,
    `/help \\- Show this message`,
  ].join("\n");
}
