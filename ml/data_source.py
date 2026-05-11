"""Fetch OHLCV candle data from Birdeye API for SOL/USDC."""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx

logger = logging.getLogger(__name__)

BIRDEYE_BASE_URL = "https://public-api.birdeye.so"
SOL_TOKEN = "So11111111111111111111111111111111111111112"
COINGECKO_URL = "https://api.coingecko.com/api/v3/coins/solana/ohlc"

MIN_CANDLES = 100


@dataclass(frozen=True)
class Candle:
    open_time: int
    open: float
    high: float
    low: float
    close: float
    volume: float


async def fetch_birdeye_candles(count: int = 150) -> list[Candle]:
    api_key = os.environ.get("BIRDEYE_API_KEY", "")
    if not api_key:
        raise RuntimeError("BIRDEYE_API_KEY not set")

    now = int(datetime.now(tz=timezone.utc).timestamp())
    time_from = now - 86400  # 24 hours to ensure enough candles despite gaps

    headers = {"X-API-KEY": api_key, "accept": "application/json"}
    params = {
        "address": SOL_TOKEN,
        "type": "1m",
        "time_from": time_from,
        "time_to": now,
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{BIRDEYE_BASE_URL}/defi/ohlcv",
            params=params,
            headers=headers,
        )
        resp.raise_for_status()
        body = resp.json()

    items = body.get("data", {}).get("items", [])
    if not items:
        raise RuntimeError("Birdeye returned no candle data")

    candles = [
        Candle(
            open_time=int(item["unixTime"]),
            open=float(item["o"]),
            high=float(item["h"]),
            low=float(item["l"]),
            close=float(item["c"]),
            volume=float(item.get("v", 0)),
        )
        for item in items
    ]

    candles.sort(key=lambda c: c.open_time)
    return candles


async def fetch_coingecko_candles() -> list[Candle]:
    """Fallback: hourly candles from CoinGecko (free, no key needed)."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            COINGECKO_URL,
            params={"vs_currency": "usd", "days": "1"},
        )
        resp.raise_for_status()
        data = resp.json()

    candles = [
        Candle(
            open_time=int(row[0] / 1000),
            open=float(row[1]),
            high=float(row[2]),
            low=float(row[3]),
            close=float(row[4]),
            volume=0.0,
        )
        for row in data
        if len(row) >= 5
    ]

    candles.sort(key=lambda c: c.open_time)
    return candles


async def fetch_candles(count: int = 150) -> list[Candle]:
    """Fetch candles with Birdeye primary, CoinGecko fallback."""
    try:
        candles = await fetch_birdeye_candles(count)
        if len(candles) >= MIN_CANDLES:
            return candles
        logger.warning("Birdeye returned only %d candles", len(candles))
    except Exception as exc:
        logger.warning("Birdeye fetch failed: %s", exc)

    logger.info("Falling back to CoinGecko")
    return await fetch_coingecko_candles()
