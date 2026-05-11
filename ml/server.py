"""FastAPI ML prediction service for SOL/USDC trading signals."""

from __future__ import annotations

import logging

import numpy as np
from fastapi import FastAPI, HTTPException

from data_source import MIN_CANDLES, fetch_candles
from indicators import compute_all_features, normalize_features
from prediction import Predictor

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Zerion ML Prediction Service")
predictor = Predictor()


@app.on_event("startup")
async def startup() -> None:
    if not predictor.load():
        logger.error("Failed to load model on startup")


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok" if predictor.is_loaded else "model_not_loaded",
        "model_version": predictor.version,
        "feature_count": len(predictor.feature_names),
    }


@app.get("/predict")
async def predict() -> dict:
    if not predictor.is_loaded:
        raise HTTPException(status_code=503, detail="Model not loaded")

    candles = await fetch_candles(150)
    if len(candles) < MIN_CANDLES:
        raise HTTPException(
            status_code=422,
            detail=f"Not enough candle data: got {len(candles)}, need {MIN_CANDLES}",
        )

    closes = np.array([c.close for c in candles])
    volumes = np.array([c.volume for c in candles])
    highs = np.array([c.high for c in candles])
    lows = np.array([c.low for c in candles])

    features = compute_all_features(closes, volumes, highs, lows, include_regime=True)
    normalized = normalize_features(features, include_regime=True)

    result = predictor.predict(normalized)
    result["price"] = features["price"]
    result["features"] = {
        k: round(v, 6) for k, v in features.items() if k != "price"
    }

    return result
