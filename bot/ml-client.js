/**
 * HTTP client for the ML prediction service.
 */

const ML_URL = process.env.ML_SERVICE_URL || "http://localhost:8002";

export async function getPrediction() {
  const resp = await fetch(`${ML_URL}/predict`, { signal: AbortSignal.timeout(20_000) });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`ML service error ${resp.status}: ${body}`);
  }
  return resp.json();
}

export async function getHealth() {
  const resp = await fetch(`${ML_URL}/health`, { signal: AbortSignal.timeout(5_000) });
  if (!resp.ok) throw new Error(`ML health check failed: ${resp.status}`);
  return resp.json();
}
