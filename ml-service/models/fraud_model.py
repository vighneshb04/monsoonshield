"""
MonsoonShield AI - Fraud Detection Model
Uses Isolation Forest for unsupervised anomaly detection.

Isolation Forest isolates anomalies by randomly selecting a feature
and then randomly selecting a split value — anomalies require fewer
splits to isolate, so they have a shorter path length in the trees.

Features used:
  - claim_amount             : size of claim relative to coverage
  - rainfall_mm              : actual rainfall at trigger time
  - claims_last_30d          : claim frequency (velocity)
  - avg_claim_amount         : historical average claim
  - days_since_policy_start  : policy age (new policies = higher risk)
  - trigger_type_encoded     : 0=volume_drop, 1=rainfall, 2=combined

Fraud signals:
  - Claiming maximum during weak trigger events
  - Very high claim frequency
  - Claims immediately after policy activation
  - Unusually high amounts vs peers in same zone
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import joblib
import os
import logging

logger = logging.getLogger("monsoonshield-ml")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "../data/fraud_model.pkl")

FEATURE_COLS = [
    "claim_amount",
    "rainfall_mm",
    "claims_last_30d",
    "avg_claim_amount",
    "days_since_policy_start",
    "trigger_type_encoded"
]


def generate_fraud_training_data(n_samples: int = 3000) -> pd.DataFrame:
    """
    Synthetic training data for fraud detection.
    Mix of legitimate (90%) and fraudulent (10%) claim patterns.
    """
    np.random.seed(42)
    n_legit = int(n_samples * 0.90)
    n_fraud = n_samples - n_legit

    # ── Legitimate claims ──────────────────────────────────────────
    legit = pd.DataFrame({
        "claim_amount": np.random.normal(1500, 400, n_legit).clip(500, 3000),
        "rainfall_mm": np.random.normal(70, 20, n_legit).clip(50, 200),   # real flood conditions
        "claims_last_30d": np.random.choice([0, 1, 2], n_legit, p=[0.7, 0.2, 0.1]),
        "avg_claim_amount": np.random.normal(1400, 300, n_legit).clip(500, 3000),
        "days_since_policy_start": np.random.uniform(3, 90, n_legit),
        "trigger_type_encoded": np.random.choice([0, 1, 2], n_legit, p=[0.3, 0.5, 0.2]),
        "is_fraud": 0
    })

    # ── Fraudulent patterns ────────────────────────────────────────
    fraud = pd.DataFrame({
        "claim_amount": np.random.normal(2800, 200, n_fraud).clip(2000, 3500),  # always max
        "rainfall_mm": np.random.normal(20, 10, n_fraud).clip(0, 50),           # low rain, still claiming
        "claims_last_30d": np.random.choice([3, 4, 5, 6], n_fraud),             # very high freq
        "avg_claim_amount": np.random.normal(2600, 200, n_fraud),               # consistently max
        "days_since_policy_start": np.random.uniform(0, 5, n_fraud),            # brand new policy
        "trigger_type_encoded": np.random.choice([0, 1, 2], n_fraud, p=[0.6, 0.3, 0.1]),
        "is_fraud": 1
    })

    return pd.concat([legit, fraud], ignore_index=True)


class FraudModel:
    def __init__(self):
        self.model = None
        self.is_trained = False
        # Thresholds for converting anomaly score to 0-10 fraud score
        self.score_min = -0.5
        self.score_max = 0.5

    def train(self):
        """Train the Isolation Forest model."""
        try:
            if os.path.exists(MODEL_PATH):
                self.model = joblib.load(MODEL_PATH)
                self.is_trained = True
                logger.info("✅ Fraud model loaded from disk")
                return

            logger.info("Training Isolation Forest fraud model...")
            df = generate_fraud_training_data(3000)

            # Train on legitimate data only (unsupervised: learn normal)
            X_legit = df[df["is_fraud"] == 0][FEATURE_COLS]

            pipeline = Pipeline([
                ("scaler", StandardScaler()),
                ("iso_forest", IsolationForest(
                    n_estimators=200,
                    contamination=0.08,   # expected ~8% fraud in real data
                    max_samples="auto",
                    random_state=42,
                    n_jobs=-1
                ))
            ])

            pipeline.fit(X_legit)

            # Evaluate on all data
            X_all = df[FEATURE_COLS]
            raw_scores = pipeline.decision_function(X_all)
            predictions = pipeline.predict(X_all)  # -1=anomaly, 1=normal

            # Check detection on fraud subset
            fraud_detected = (predictions[df["is_fraud"] == 1] == -1).mean()
            logger.info(f"Fraud detection rate on training data: {fraud_detected:.1%}")

            # Store score range for normalization
            self.score_min = float(raw_scores.min())
            self.score_max = float(raw_scores.max())

            self.model = pipeline
            self.is_trained = True

            os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
            joblib.dump(pipeline, MODEL_PATH)
            logger.info(f"Fraud model saved to {MODEL_PATH}")

        except Exception as e:
            logger.error(f"Fraud model training failed: {e}")
            self.is_trained = False

    def predict(self, features: dict) -> dict:
        """
        Returns fraud_score (0-10), where higher = more suspicious.
        Also returns flags and recommended action.
        """
        if not self.is_trained:
            raise RuntimeError("Fraud model not trained")

        X = pd.DataFrame([{col: features.get(col, 0) for col in FEATURE_COLS}])

        # Isolation Forest: lower decision score = more anomalous
        raw_score = float(self.model.decision_function(X)[0])
        prediction = int(self.model.predict(X)[0])  # -1=anomaly, 1=normal

        # Normalize to 0-10 fraud score (inverted: low raw = high fraud score)
        score_range = max(self.score_max - self.score_min, 0.001)
        normalized = (raw_score - self.score_min) / score_range  # 0=most fraud, 1=cleanest
        fraud_score = round((1 - normalized) * 10, 2)
        fraud_score = min(max(fraud_score, 0.0), 10.0)

        # Rule-based flags on top of ML
        flags = []
        if features.get("claims_last_30d", 0) >= 4:
            flags.append("HIGH_CLAIM_VELOCITY")
        if features.get("days_since_policy_start", 90) < 3:
            flags.append("NEW_POLICY_CLAIM")
        if features.get("rainfall_mm", 0) < 40 and features.get("trigger_type_encoded", 1) == 1:
            flags.append("LOW_RAINFALL_RAINFALL_CLAIM")
        if features.get("claim_amount", 0) > features.get("avg_claim_amount", 0) * 2:
            flags.append("CLAIM_AMOUNT_SPIKE")

        # Elevate score if rule flags found
        if len(flags) >= 2:
            fraud_score = min(fraud_score + 2.0, 10.0)
        elif len(flags) == 1:
            fraud_score = min(fraud_score + 1.0, 10.0)

        action = (
            "blocked" if fraud_score >= 7.5
            else "flagged" if fraud_score >= 5.0
            else "approved"
        )

        return {
            "fraud_score": round(fraud_score, 2),
            "is_anomaly": prediction == -1,
            "raw_isolation_score": raw_score,
            "flags": flags,
            "action": action,
            "ml_model": "IsolationForest",
            "details": {
                "n_estimators": 200,
                "contamination": 0.08,
                "features_analyzed": FEATURE_COLS
            }
        }
