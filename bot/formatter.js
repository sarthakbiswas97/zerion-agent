/**
 * Telegram message formatting utilities (Markdown V2).
 */

function escMd(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

export function formatPrediction(pred) {
  const arrow = pred.direction === "UP" ? "UP" : "DOWN";
  const pct = (pred.confidence * 100).toFixed(1);

  const shapLines = Object.entries(pred.shap_explanation || {})
    .map(([name, info]) => `  ${escMd(name)}: ${escMd(info.direction)} \\(${escMd(info.value)}\\)`)
    .join("\n");

  return [
    `*SOL/USDC Prediction*`,
    ``,
    `Direction: *${escMd(arrow)}*`,
    `Confidence: *${escMd(pct)}%*`,
    `Price: \\$${escMd(Number(pred.price).toFixed(2))}`,
    ``,
    `*Key Factors:*`,
    shapLines,
  ].join("\n");
}

export function formatTrade(prediction, swapResult) {
  const tx = swapResult.tx || {};
  const swap = swapResult.swap || {};

  return [
    `*Trade Executed*`,
    ``,
    `Signal: *${escMd(prediction.direction)}* \\(${escMd((prediction.confidence * 100).toFixed(1))}%\\)`,
    `Swap: ${escMd(swap.input || "?")} \\-\\> ${escMd(swap.output || "?")}`,
    `Chain: ${escMd(swapResult.swap?.chain || "solana")}`,
    `TX: \`${escMd(tx.hash || "pending")}\``,
    `Status: ${escMd(tx.status || "submitted")}`,
  ].join("\n");
}

export function formatPortfolio(data) {
  if (!data || (!data.totalValue && !data.positions)) {
    return `*Portfolio*\n\nNo data available\\. Make sure your wallet is funded\\.`;
  }

  const lines = [`*Portfolio Overview*`, ``];

  if (data.totalValue) {
    lines.push(`Total Value: *\\$${escMd(data.totalValue)}*`);
    lines.push(``);
  }

  const positions = data.positions || data.topPositions || [];
  if (positions.length > 0) {
    lines.push(`*Positions:*`);
    for (const pos of positions.slice(0, 10)) {
      const symbol = pos.symbol || pos.name || "?";
      const value = pos.value ? `$${pos.value}` : "";
      const amount = pos.quantity || pos.amount || "";
      lines.push(`  ${escMd(symbol)}: ${escMd(amount)} ${escMd(value)}`);
    }
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
    `*Zerion Trading Agent*`,
    ``,
    `/predict \\- Get ML prediction for SOL/USDC`,
    `/trade <amount> \\- Execute swap based on prediction`,
    `/status \\- Show wallet portfolio`,
    `/policy \\- Show active trading policies`,
    `/help \\- Show this message`,
  ].join("\n");
}
