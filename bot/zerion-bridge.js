/**
 * Spawns Zerion CLI as a child process and parses JSON output.
 * All trading operations go through the CLI to leverage its policy enforcement.
 */

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, "..", "cli", "zerion.js");

const SPAWN_TIMEOUT_MS = 60_000;

function spawnZerion(args) {
  return new Promise((resolveP, reject) => {
    const env = { ...process.env };
    if (process.env.ZERION_AGENT_TOKEN) {
      env.ZERION_AGENT_TOKEN = process.env.ZERION_AGENT_TOKEN;
    }

    const proc = spawn("node", [CLI_PATH, ...args], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error(`Zerion CLI timed out after ${SPAWN_TIMEOUT_MS / 1000}s`));
    }, SPAWN_TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const errMsg = tryParseError(stderr) || stderr.trim() || `Exit code ${code}`;
        reject(new Error(errMsg));
        return;
      }
      try {
        resolveP(JSON.parse(stdout));
      } catch {
        resolveP({ raw: stdout.trim() });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function tryParseError(stderr) {
  try {
    const parsed = JSON.parse(stderr);
    return parsed.message || parsed.error || null;
  } catch {
    return null;
  }
}

export async function executeSwap(chain, amount, fromToken, toToken) {
  return spawnZerion(["swap", chain, String(amount), fromToken, toToken]);
}

export async function getPortfolio(walletName) {
  const args = ["portfolio"];
  if (walletName) args.push(walletName);
  return spawnZerion(args);
}

export async function getPositions(walletName) {
  const args = ["positions"];
  if (walletName) args.push(walletName);
  return spawnZerion(args);
}

export async function listPolicies() {
  return spawnZerion(["agent", "list-policies"]);
}

export async function listTokens() {
  return spawnZerion(["agent", "list-tokens"]);
}

export async function getHistory(walletName) {
  const args = ["history"];
  if (walletName) args.push(walletName);
  return spawnZerion(args);
}

export async function searchToken(query, chain) {
  const args = ["search", query];
  if (chain) args.push("--chain", chain);
  return spawnZerion(args);
}
