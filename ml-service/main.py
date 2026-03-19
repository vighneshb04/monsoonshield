"""
MonsoonShield AI - ML Microservice
FastAPI + Scikit-learn

Endpoints:
  POST /calculate-premium  - AI premium regression model
  POST /fraud-detect       - Isolation Forest anomaly detection
  GET  /health             - health check
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import logging

from models.premium_model import PremiumModel
from models.fraud_model import FraudModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("monsoonshield-ml")

app = FastAPI(
    title="MonsoonShield AI - ML Service",
    description="Premium calculation and fraud detection for parametric insurance",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Load models on startup ──────────────────────────────────────────────────
premium_model = PremiumModel()
fraud_model = FraudModel()

@app.on_event("startup")
async def startup_event():
    logger.info("Training/loading ML models...")
    premium_model.train()
    fraud_model.train()
    logger.info("✅ ML models ready")


# ─── Schemas ─────────────────────────────────────────────────────────────────
class PremiumRequest(BaseModel):
    flood_risk_score: float        # 0-10
    zone_multiplier: float         # 1.0-2.0
    coverage_amount: float         # INR (e.g. 2000)
    rider_risk_score: float = 5.0  # 0-10
    rainfall_mm: float = 0.0
    rainfall_24h: float = 0.0
    past_claims: int = 0

class FraudFeatures(BaseModel):
    claim_amount: float
    rainfall_mm: float
    claims_last_30d: int
    avg_claim_amount: float
    days_since_policy_start: float
    trigger_type_encoded: int      # 0=volume, 1=rainfall, 2=combined

class FraudRequest(BaseModel):
    features: FraudFeatures


# ─── Endpoints ───────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "MonsoonShield ML",
        "models": {
            "premium": premium_model.is_trained,
            "fraud": fraud_model.is_trained
        }
    }

@app.post("/calculate-premium")
def calculate_premium(req: PremiumRequest):
    try:
        result = premium_model.predict(req.dict())
        return result
    except Exception as e:
        logger.error(f"Premium calculation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fraud-detect")
def fraud_detect(req: FraudRequest):
    try:
        result = fraud_model.predict(req.features.dict())
        return result
    except Exception as e:
        logger.error(f"Fraud detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/retrain")
def retrain_models():
    premium_model.train()
    fraud_model.train()
    return {"success": True, "message": "Models retrained successfully"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
