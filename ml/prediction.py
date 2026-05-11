"""XGBoost model loading, inference, and SHAP explanation."""

from __future__ import annotations

import logging
from pathlib import Path

import joblib
import numpy as np
import shap

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent / "models" / "model_bundle_latest.joblib"


class Predictor:
    def __init__(self) -> None:
        self.model = None
        self.metadata: dict = {}
        self.feature_names: list[str] = []
        self.explainer = None

    def load(self, model_path: Path = MODEL_PATH) -> bool:
        if not model_path.exists():
            logger.error("Model file not found: %s", model_path)
            return False

        bundle = joblib.load(model_path)
        self.model = bundle["model"]
        self.metadata = bundle["metadata"]
        self.feature_names = self.metadata["features"]
        self.explainer = shap.TreeExplainer(self.model)

        logger.info(
            "Model loaded: version=%s, features=%d",
            self.metadata.get("version", "unknown"),
            len(self.feature_names),
        )
        return True

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    @property
    def version(self) -> str:
        return self.metadata.get("version", "unknown")

    def predict(self, feature_array: np.ndarray) -> dict:
        """Run inference on a normalized feature array.

        Args:
            feature_array: 1D numpy array of normalized features matching self.feature_names

        Returns:
            dict with direction, confidence, and shap_explanation
        """
        if not self.is_loaded:
            raise RuntimeError("Model not loaded")

        features_2d = feature_array.reshape(1, -1)

        pred_class = int(self.model.predict(features_2d)[0])
        pred_proba = self.model.predict_proba(features_2d)[0]

        direction = "UP" if pred_class == 1 else "DOWN"
        confidence = float(pred_proba[1] if pred_class == 1 else pred_proba[0])

        shap_values = self.explainer.shap_values(features_2d)[0]
        shap_pairs = list(zip(self.feature_names, shap_values))
        top_features = sorted(shap_pairs, key=lambda x: abs(x[1]), reverse=True)[:3]

        shap_explanation = {
            name: {
                "value": round(float(val), 4),
                "direction": "pushes UP" if val > 0 else "pushes DOWN",
            }
            for name, val in top_features
        }

        return {
            "direction": direction,
            "confidence": round(confidence, 4),
            "shap_explanation": shap_explanation,
        }
