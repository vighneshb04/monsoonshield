"""
MonsoonShield AI - Premium Calculation Model
Uses Gradient Boosting Regressor to predict weekly insurance premium.

Formula basis:
  Premium = BaseRate + (FloodRiskScore × ZoneMultiplier) - SafetyDiscount

Features:
  - flood_risk_score     : 0-10 (zone historical flood risk)
  - zone_multiplier      : pricing multiplier for zone
  - coverage_amount      : rider's desired weekly income coverage (INR)
  - rider_risk_score     : individual risk score from past behavior
  - rainfall_mm          : recent 3-hour rainfall (weather signal)
  - rainfall_24h         : 24-hour cumulative rainfall
  - past_claims          : number of claims in last 90 days (no-claim discount)
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os
import logging

logger = logging.getLogger("monsoonshield-ml")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "../data/premium_model.pkl")


def generate_training_data(n_samples: int = 2000) -> pd.DataFrame:
    """
    Generate synthetic training data based on Mumbai monsoon insurance domain knowledge.
    In production, this would be replaced with real historical claims + weather data.
    """
    np.random.seed(42)

    flood_risk = np.random.uniform(3.0, 9.5, n_samples)
    zone_multiplier = 1.0 + (flood_risk - 3.0) / 10.0 + np.random.normal(0, 0.05, n_samples)
    zone_multiplier = np.clip(zone_multiplier, 1.0, 2.0)

    coverage_amount = np.random.choice([1500, 2000, 2500, 3000], n_samples, p=[0.2, 0.4, 0.3, 0.1])
    rider_risk_score = np.random.beta(2, 3, n_samples) * 10  # slightly left-skewed
    rainfall_mm = np.random.exponential(15, n_samples)       # right-skewed, most days low rain
    rainfall_24h = rainfall_mm * np.random.uniform(2, 5, n_samples)
    past_claims = np.random.choice([0, 1, 2, 3], n_samples, p=[0.55, 0.25, 0.15, 0.05])

    # ── Premium formula (ground truth with noise) ────────────────────────────
    base_rate = coverage_amount * 0.030                            # 3% of coverage
    risk_component = flood_risk * zone_multiplier * 0.9           # core risk
    rainfall_component = np.where(rainfall_mm > 30, 8, 0)         # current weather uplift
    rider_component = rider_risk_score * 0.4                      # individual risk
    safety_discount = np.where(past_claims == 0, base_rate * 0.20, 0)  # no-claim discount

    premium = (base_rate
               + risk_component
               + rainfall_component
               + rider_component
               - safety_discount
               + np.random.normal(0, 3, n_samples))  # noise

    premium = np.clip(premium, 30, 300)  # realistic weekly premium range

    return pd.DataFrame({
        "flood_risk_score": flood_risk,
        "zone_multiplier": zone_multiplier,
        "coverage_amount": coverage_amount,
        "rider_risk_score": rider_risk_score,
        "rainfall_mm": rainfall_mm,
        "rainfall_24h": rainfall_24h,
        "past_claims": past_claims,
        "premium": premium
    })


class PremiumModel:
    def __init__(self):
        self.model = None
        self.is_trained = False
        self.feature_cols = [
            "flood_risk_score", "zone_multiplier", "coverage_amount",
            "rider_risk_score", "rainfall_mm", "rainfall_24h", "past_claims"
        ]

    def train(self):
        """Train or retrain the premium prediction model."""
        try:
            # Try loading saved model first
            if os.path.exists(MODEL_PATH):
                self.model = joblib.load(MODEL_PATH)
                self.is_trained = True
                logger.info("✅ Premium model loaded from disk")
                return

            logger.info("Training premium model from synthetic data...")
            df = generate_training_data(2000)
            X = df[self.feature_cols]
            y = df["premium"]

            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

            pipeline = Pipeline([
                ("scaler", StandardScaler()),
                ("model", GradientBoostingRegressor(
                    n_estimators=200,
                    learning_rate=0.05,
                    max_depth=4,
                    min_samples_leaf=5,
                    random_state=42
                ))
            ])

            pipeline.fit(X_train, y_train)

            # Evaluate
            y_pred = pipeline.predict(X_test)
            mae = mean_absolute_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            logger.info(f"Premium model trained | MAE: ₹{mae:.2f} | R²: {r2:.4f}")

            self.model = pipeline
            self.is_trained = True

            # Save model
            os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
            joblib.dump(pipeline, MODEL_PATH)
            logger.info(f"Model saved to {MODEL_PATH}")

        except Exception as e:
            logger.error(f"Premium model training failed: {e}")
            self.is_trained = False

    def predict(self, features: dict) -> dict:
        """Predict weekly premium given rider + zone features."""
        if not self.is_trained:
            raise RuntimeError("Premium model not trained")

        X = pd.DataFrame([{col: features.get(col, 0) for col in self.feature_cols}])
        raw_premium = float(self.model.predict(X)[0])
        weekly_premium = round(max(30.0, raw_premium), 2)

        # Build breakdown
        coverage = features.get("coverage_amount", 2000)
        base_rate = round(coverage * 0.030, 2)
        flood_risk = features.get("flood_risk_score", 5.0)
        zone_mult = features.get("zone_multiplier", 1.5)
        past_claims = features.get("past_claims", 0)
        safety_discount = round(base_rate * 0.20, 2) if past_claims == 0 else 0.0

        return {
            "weekly_premium": weekly_premium,
            "breakdown": {
                "base_rate": base_rate,
                "flood_risk_component": round(flood_risk * zone_mult * 0.9, 2),
                "safety_discount": safety_discount,
                "coverage_amount": coverage,
                "flood_risk_score": flood_risk,
                "zone_multiplier": zone_mult
            },
            "ml_model": "GradientBoostingRegressor",
            "confidence": "high" if self.is_trained else "fallback"
        }
