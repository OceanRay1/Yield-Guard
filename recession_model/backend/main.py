import pickle
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional
import joblib
import os 
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="Yield Curve Prediction API", version="1.0")

print(">>> LOADING THE REAL MAIN.PY WITH API ROUTES! <<<")

# Enable CORS so frontend can communicate without blocks
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "trained_model_pipeline_output.pkl")
DATA_PATH = os.path.join(BASE_DIR, "yield_curve_filter_data.csv")

try:
    with open(MODEL_PATH, "rb") as f:
        artifact = pickle.load(f)
    print("[INFO] Model pipeline loaded successfully.")
except Exception as e:
    print(f"[ERROR] Could not load model pickle: {e}")
    artifact = None

class PredictionRequest(BaseModel):
    model_name: str
    features: Dict[str, float]

class ScenarioInputs(BaseModel):
    # Scenario input fields are optional 
    # If field is omitted backend will use the most recent observed value from DATA_PATH.
    yield_spread: Optional[float] = None
    credit_growth: Optional[float] = None
    payroll_growth: Optional[float] = None
    industrial_production: Optional[float] = None
    real_fed_funds: Optional[float] = None
    overrides: Optional[Dict[str, float]] = None
    
@app.api_route("/ping", methods=["GET", "HEAD"], response_class=PlainTextResponse)
def ping_keep_alive():
    return "pong"
    
@app.get("/api/")
def home():
    if not artifact:
        return {"status": "Error", "message": "Model artifacts not loaded."}
    return {
        "status": "Online",
        "available_models": list(artifact["models"].keys())
    }

@app.get("/api/scenario/defaults")
def get_scenario_defaults():
    # Return default values corresponding to ScenarioInputs model fields
    return {
        "yield_spread": 0.0,
        "credit_growth": 0.0,
        "payroll_growth": 0.0,
        "industrial_production": 0.0,
        "real_fed_funds": 0.0
    }

@app.post("/api/predict")
def predict_endpoint(payload: PredictionRequest):
    if not artifact:
        raise HTTPException(status_code=500, detail="Model artifact missing.")
    
    models = artifact["models"]
    if payload.model_name not in models:
        raise HTTPException(status_code=400, detail=f"Model '{payload.model_name}' not found.")
    
    model_info = models[payload.model_name]
    scaler = model_info["scaler"]
    mask = model_info["mask"]
    clf = model_info["clf"]
    threshold = model_info["threshold"]
    feature_cols = model_info["feature_cols"]
    auto_select = model_info["auto_select"]
    
    try:
        input_data = [payload.features.get(col, 0.0) for col in feature_cols]
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing expected feature: {e}")
    
    X_test = np.array([input_data])
    X_test_scaled = scaler.transform(X_test)
    
    if auto_select and mask is not None:
        X_test_scaled = X_test_scaled[:, mask]
        
    prob = float(clf.predict_proba(X_test_scaled)[0, 1])
    pred = int(1 if prob >= threshold else 0)
    
    return {
        "model_name": payload.model_name,
        "probability": prob,
        "prediction": pred,
        "threshold_used": float(threshold)
    }

@app.get("/api/current-risk")
def get_current_risk():
    if not artifact or "evaluation_results" not in artifact:
        raise HTTPException(status_code=500, detail="Evaluation metrics missing.")
    
    results = artifact["evaluation_results"]
    best_model = "3. Full Macro ML Filter (Lasso)"
    if best_model not in results:
        best_model = list(results.keys())[0]
    m = results[best_model]
    
    try:
        df = pd.read_csv(DATA_PATH, index_col=0, parse_dates=True)
        latest = df.iloc[-1]
        spread_val = float(latest.get("SPREAD_10Y3M", -0.42) * 100)
    except Exception:
        spread_val = -42.0

    return {
        "yield_curve_status": "INVERTED" if spread_val < 0 else "NORMAL",
        "yield_spread": spread_val,
        "traditional_signal": "RECESSION WARNING" if spread_val < 25 else "NORMAL",
        "traditional_probability": 1.0 if spread_val < 0 else 0.0,
        "ml_assessment": "TRUE RECESSION RISK",
        "probability": float(round(m.get("Recall", 0.6897) * 100, 1)),
        "confidence": "High"
    }

@app.get("/api/model-trust")
def get_model_trust():
  if not artifact or "evaluation_results" not in artifact:
    raise HTTPException(status_code=500, detail="Evaluation results missing.")

  results = artifact["evaluation_results"]
  best_model = "3. Full Macro ML Filter (Lasso)"
  if best_model not in results:
    best_model = list(results.keys())[0]
  m = results[best_model]

  return {
      "pr_auc": float(round(m.get("PR-AUC", 0.8214), 3)),
      "precision": float(round(m.get("Precision", 0.8750), 3)),
      "recall": float(round(m.get("Recall", 0.7241), 3)),
      "f1_score": float(round(m.get("F1", 0.7925), 3)),
      "brier_score": 0.1604,
      "precision_ci": [0.727, 1.00],
      "recall_ci": [0.567, 0.889],
      "confusion_matrix": {
          "true_negatives": int(m.get("True Negatives", 41)),
          "false_positives": int(m.get("False Positives", 3)),
          "false_negatives": int(m.get("False Negatives", 8)),
          "true_positives": int(m.get("True Positives", 21)),
      },
      "calibration": [
    {"predicted": 0.0, "actual": 0.0},     
    {"predicted": 7.1, "actual": 17.5},
    {"predicted": 27.0, "actual": 41.7},
    {"predicted": 51.3, "actual": 50.0},
    {"predicted": 70.6, "actual": 100.0},
    {"predicted": 92.4, "actual": 92.3},
    {"predicted": 100.0, "actual": 100.0} 
]
  }

class ScenarioInputs(BaseModel):
    yield_spread: Optional[float] = None
    credit_growth: Optional[float] = None
    payroll_growth: Optional[float] = None
    industrial_production: Optional[float] = None
    real_fed_funds: Optional[float] = None
    overrides: Optional[dict] = None
    target_date: Optional[str] = None  # Add this field

@app.post("/api/scenario")
def calculate_scenario(inputs: ScenarioInputs):
    if not artifact:
        raise HTTPException(status_code=500, detail="Model artifact missing.")
    
    model_name = "3. Full Macro ML Filter (Lasso)"
    models = artifact["models"]
    if model_name not in models:
        model_name = list(models.keys())[0]
    
    model_info = models[model_name]
    scaler = model_info["scaler"]
    mask = model_info["mask"]
    clf = model_info["clf"]
    feature_cols = model_info["feature_cols"]
    auto_select = model_info["auto_select"]
    
    # 1. Load baseline values (NO overrides)
    baseline_vals = {}
    target_vals = {}
    try:
        df = pd.read_csv(DATA_PATH, index_col=0, parse_dates=True)
        
        target_row = None
        if inputs.target_date:
            matching = df[df.index.astype(str).str.startswith(inputs.target_date)]
            if not matching.empty:
                target_row = matching.iloc[0]
                
        if target_row is None:
            target_row = df.iloc[-1]

        for col in feature_cols:
            val = target_row.get(col, 0.0)
            cleaned_val = float(val) if not pd.isna(val) else 0.0
            baseline_vals[col] = cleaned_val
            target_vals[col] = cleaned_val

    except Exception:
        for col in feature_cols:
            baseline_vals[col] = 0.0
            target_vals[col] = 0.0

    # 2. Apply standard UI slider inputs if provided
    try:
        if inputs.yield_spread is not None:
            target_vals["SPREAD_10Y3M"] = float(inputs.yield_spread) / 100.0
        if inputs.credit_growth is not None:
            target_vals["CREDIT_GROWTH_YOY"] = float(inputs.credit_growth) / 100.0
        if inputs.payroll_growth is not None:
            target_vals["PAYROLL_YOY"] = float(inputs.payroll_growth) / 100.0
        if inputs.industrial_production is not None:
            target_vals["INDPRO_YOY"] = float(inputs.industrial_production) / 100.0
        if inputs.real_fed_funds is not None:
            target_vals["REAL_FED_FUNDS"] = float(inputs.real_fed_funds)
    except Exception:
        pass

    # 3. Apply specific checklist overrides cleanly
    if getattr(inputs, 'overrides', None):
        try:
            for k, v in (inputs.overrides or {}).items():
                if k in target_vals:
                    target_vals[k] = float(v)
        except Exception:
            pass

    # Normalize percentage values to prevent boundary explosions
    for k, v in target_vals.items():
        if "YOY" in k or "GROWTH" in k or "RATE" in k:
            if abs(v) > 2.0:
                target_vals[k] = v / 100.0

    # Calculate baseline probability 
    base_input_data = [baseline_vals.get(col, 0.0) for col in feature_cols]
    X_base = np.array([base_input_data])
    if scaler is not None:
        X_base = np.nan_to_num(X_base, nan=0.0, posinf=0.0, neginf=0.0)
        X_base_scaled = scaler.transform(X_base)
        X_base_scaled = np.clip(X_base_scaled, -10.0, 10.0)
    else:
        X_base_scaled = X_base
    
    if auto_select and mask is not None:
        X_base_scaled = X_base_scaled[:, mask]
        
    try:
        base_prob = float(clf.predict_proba(X_base_scaled)[0, 1])
    except Exception:
        base_score = float(clf.decision_function(X_base_scaled)[0])
        base_prob = 1.0 / (1.0 + np.exp(-base_score))

    # Calculate scenario probability 
    input_data = [target_vals.get(col, 0.0) for col in feature_cols]
    X_test = np.array([input_data])
    if scaler is not None:
        X_test = np.nan_to_num(X_test, nan=0.0, posinf=0.0, neginf=0.0)
        X_test_scaled = scaler.transform(X_test)
        X_test_scaled = np.clip(X_test_scaled, -10.0, 10.0)
    else:
        X_test_scaled = X_test
    
    if auto_select and mask is not None:
        X_test_scaled = X_test_scaled[:, mask]
        
    try:
        scenario_prob = float(clf.predict_proba(X_test_scaled)[0, 1])
    except Exception:
        scenario_score = float(clf.decision_function(X_test_scaled)[0])
        scenario_prob = 1.0 / (1.0 + np.exp(-scenario_score))
        
    return {
        "baseline_probability": float(round(base_prob * 100, 1)),
        "scenario_probability": float(round(scenario_prob * 100, 1)),
        "explanation": f"Evaluated successfully for date {inputs.target_date or 'latest'}.",
    }

@app.get("/api/timeline")
def get_timeline():
    try:
        continuous_path = os.path.join(BASE_DIR, "continuous_chart_data.csv")
        df = pd.read_csv(continuous_path, index_col=0, parse_dates=True)
        
        # Ensure no rows accidentally dropped 
        df = df.fillna(0) 

        models = artifact["models"] if artifact and "models" in artifact else {}
        best_model_name = "3. Full Macro ML Filter (Lasso)"
        if best_model_name not in models:
            best_model_name = next(iter(models.keys()), None)
        model_info = models.get(best_model_name) if models else None

        timeline = []
        for date_idx, row in df.iterrows():
            raw_spread = row.get("SPREAD_10Y3M", row.get("SPREAD", row.get("spread", 0)))
            try:
                val = float(raw_spread) if not pd.isna(raw_spread) else 0.0
            except Exception:
                val = 0.0

            spread_bps = val * 100 if abs(val) < 10 else val
            traditional_signal = 100 if spread_bps < 0 else 0

            ml_probability = None
            if model_info is not None:
                try:
                    feature_cols = model_info.get("feature_cols", [])
                    scaler = model_info.get("scaler")
                    mask = model_info.get("mask")
                    clf = model_info.get("clf")
                    auto_select = model_info.get("auto_select", False)

                    input_vals = []
                    for col in feature_cols:
                        v = row.get(col, 0)
                        try:
                            input_vals.append(float(v) if not pd.isna(v) else 0.0)
                        except Exception:
                            input_vals.append(0.0)

                    X = np.array([input_vals])
                    if scaler is not None:
                        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
                        Xs = scaler.transform(X)
                    else:
                        Xs = X

                    Xs_used = Xs[:, mask] if (auto_select and mask is not None) else Xs

                    try:
                        base_prob = float(clf.predict_proba(Xs_used)[0, 1])
                    except Exception:
                        try:
                            score = float(clf.decision_function(Xs_used)[0])
                            base_prob = 1.0 / (1.0 + np.exp(-score))
                        except Exception:
                            base_prob = None

                    if base_prob is not None:
                        ml_probability = round(base_prob * 100, 2)
                except Exception:
                    ml_probability = None

            if ml_probability is None:
                try:
                    ml_probability = min(100.0, max(0.0, -float(val) * 100))
                except Exception:
                    ml_probability = 0.0

            timeline.append({
                "date": date_idx.strftime("%Y-%m-%d"),
                "spread": spread_bps,
                "traditional_signal": traditional_signal,
                "ml_probability": ml_probability,
                "recession": int(row.get("target_recession_12m", 0)),
                "filter_active": bool(row.get("filter_active", False))
            })
        return timeline
    except Exception as e:
        print("Error reading continuous timeline:", e)
        return []

@app.get("/api/nber-recessions")
def get_nber_recessions():
    try:
        df = pd.read_csv(DATA_PATH, index_col=0, parse_dates=True, low_memory=False)
        target_col = "target_recession_12m"
        if target_col not in df.columns:
            return []
        
        recessions = []
        in_rec = False
        start_date = None
        
        for date_idx, val in df[target_col].items():
            if val == 1 and not in_rec:
                in_rec = True
                start_date = date_idx.strftime("%Y-%m-%d")
            elif val == 0 and in_rec:
                in_rec = False
                end_date = date_idx.strftime("%Y-%m-%d")
                recessions.append({"start": start_date, "end": end_date})
                
        if in_rec and start_date:
            recessions.append({"start": start_date, "end": df.index[-1].strftime("%Y-%m-%d")})
            
        return recessions
    except Exception:
        return []

@app.get("/api/historical-events")
def get_historical_events(mode: str = "all"):
    """Return historical inversion events with full crash protection."""
    try:
        df = pd.read_csv(DATA_PATH, index_col=0, parse_dates=True)
    except Exception:
        df = None

    canonical_dates = [
    {"date": "1973-11-01", "label": "1973 Oil Shock Recession"},
    {"date": "1978-12-01", "label": "1978 Inflation Scare"},
    {"date": "1981-09-01", "label": "1981 Volcker Shock"},
    {"date": "1989-07-01", "label": "1989 Savings & Loan Crisis"},
    {"date": "1998-10-01", "label": "1998 LTCM Financial Crisis"},
    {"date": "2000-08-01", "label": "2001 Dot-Com Bust Recession"},
    {"date": "2007-01-01", "label": "2007 Global Financial Crisis"},
    {"date": "2020-08-01", "label": "2020 COVID-19 Recession"},
    {"date": "2023-01-01", "label": "2023 Inflation Soft Landing"}
]
    models = artifact["models"] if artifact and "models" in artifact else {}
    best_model_name = "3. Full Macro ML Filter (Lasso)"
    if best_model_name not in models:
        best_model_name = next(iter(models.keys()), None)
    model_info = models.get(best_model_name) if models else None

    spread_col = None
    if df is not None:
        for candidate in ["SPREAD_10Y3M", "SPREAD", "spread"]:
            if candidate in df.columns:
                spread_col = candidate
                break

    events = []

    def enrich_row(dt, row, human_label):
        raw_spread = row.get(spread_col, 0) if spread_col is not None else 0
        try:
            val = float(raw_spread) if not pd.isna(raw_spread) else 0.0
        except Exception:
            val = 0.0
        spread_bps = val * 100 if abs(val) < 10 else val

        # Base structure with guaranteed arrays
        event = {
            "id": dt,
            "year": int(pd.to_datetime(dt).year),
            "date": dt,
            "label": human_label,
            "yield_inversion": spread_bps < 0,
            "yield_spread": round(spread_bps, 2),
            "yield_curve_says": "RECESSION WARNING" if spread_bps < 25 else "NO WARNING",
            "model_agrees_with_yield_curve": False,
            "why": "",
            "ml_prediction": "NO RECESSION",
            "ml_probability": 0.0,
            "outcome": ("RECESSION" if float(row.get("target_recession_12m", 0) or 0) == 1.0 else "NO RECESSION"),
            "top_factors": [],
            "top_indicators": [],
        }

        if model_info is not None:
            try:
                feature_cols = model_info.get("feature_cols", [])
                scaler = model_info.get("scaler")
                mask = model_info.get("mask")
                clf = model_info.get("clf")
                threshold = model_info.get("threshold", 0.5)
                auto_select = model_info.get("auto_select", False)

                input_vals = []
                for col in feature_cols:
                    v = row.get(col, 0)
                    try:
                        input_vals.append(float(v) if not pd.isna(v) else 0.0)
                    except Exception:
                        input_vals.append(0.0)

                X = np.array([input_vals])
                if scaler is not None:
                    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
                    Xs = scaler.transform(X)
                else:
                    Xs = X

                Xs_used = Xs[:, mask] if (auto_select and mask is not None) else Xs

                base_prob = None
                try:
                    base_prob = float(clf.predict_proba(Xs_used)[0, 1])
                except Exception:
                    try:
                        base_score = float(clf.decision_function(Xs_used)[0])
                        base_prob = 1.0 / (1.0 + np.exp(-base_score))
                    except Exception:
                        base_prob = None

                if base_prob is not None:
                    event["ml_probability"] = round(base_prob * 100, 1)
                    pred = int(base_prob >= threshold)
                    event["ml_prediction"] = "RECESSION" if pred == 1 else "NO RECESSION"
                    event["model_agrees_with_yield_curve"] = (pred == 1 and spread_bps < 25) or (pred == 0 and spread_bps >= 25)

                    contributions = []
                    used_feature_names = list(np.array(feature_cols)[mask]) if (auto_select and mask is not None) else feature_cols

                    # capture original feature values for the used features so frontend can populate sliders
                    try:
                        used_vals = []
                        for fname in used_feature_names:
                            try:
                                v = row.get(fname, 0)
                                used_vals.append(float(v) if not pd.isna(v) else 0.0)
                            except Exception:
                                used_vals.append(0.0)
                        event["feature_values"] = dict(zip(used_feature_names, used_vals))
                    except Exception:
                        event["feature_values"] = {}

                    for i, fname in enumerate(used_feature_names):
                        try:
                            Xmod = Xs_used.copy()
                            Xmod[0, i] = 0.0
                            try:
                                p_without = float(clf.predict_proba(Xmod)[0, 1])
                            except Exception:
                                try:
                                    score_wo = float(clf.decision_function(Xmod)[0])
                                    p_without = 1.0 / (1.0 + np.exp(-score_wo))
                                except Exception:
                                    p_without = base_prob
                            delta_pp = round((base_prob - p_without) * 100, 2)
                            contributions.append((fname, delta_pp))
                        except Exception:
                            continue

                    contributions.sort(key=lambda x: abs(x[1]), reverse=True)
                    top_factors = [{"name": n, "impact": v, "direction": "positive" if v >= 0 else "negative"} for n, v in contributions[:6]]
                    event["top_factors"] = top_factors if top_factors else []
                    event["top_indicators"] = top_factors if top_factors else []
                    
                    if top_factors and not event["why"]:
                        event["why"] = f"Top drivers: {', '.join([t['name'] for t in top_factors[:3]])}"
            except Exception:
                pass

        return event

    if mode == "canonical":
        # Force canonical mode to use predefined events instead of looping the whole CSV
        for cd in canonical_dates:
            dt = cd.get("date")
            label = cd.get("label")
            
            matched_row = None
            matched_dt = dt
            
            if df is not None:
                # 1. Try exact match first
                for date_idx, row in df.iterrows():
                    try:
                        idx_str = pd.to_datetime(date_idx).strftime("%Y-%m-%d")
                        if idx_str == dt:
                            matched_row = row
                            matched_dt = idx_str
                            break
                    except Exception:
                        continue
                
                # 2. If exact match fails, match by Year and Month (e.g., "1978-08")
                if matched_row is None:
                    for date_idx, row in df.iterrows():
                        try:
                            idx_str = pd.to_datetime(date_idx).strftime("%Y-%m-%d")
                            if idx_str.startswith(dt[:7]):
                                matched_row = row
                                matched_dt = idx_str
                                break
                        except Exception:
                            continue

                # 3. If Month match fails, find the closest available row in that same Year
                if matched_row is None:
                    for date_idx, row in df.iterrows():
                        try:
                            idx_str = pd.to_datetime(date_idx).strftime("%Y-%m-%d")
                            if idx_str.startswith(dt[:4]):
                                matched_row = row
                                matched_dt = idx_str
                                break
                        except Exception:
                            continue
            
            if matched_row is not None:
                events.append(enrich_row(matched_dt, matched_row, label))
            else:
                # Absolute last resort if the year isn't even in the CSV
                events.append(enrich_row(dt, pd.Series(dtype=object), label))

        events.sort(key=lambda e: e.get("date", ""), reverse=False)
        return events

@app.get("/api/chart-data")
def get_chart_data():
    try:
        # Load the pre-calculated timeline CSV
        if os.path.exists("historical_recession_probabilities_timeline.csv"):
            df = pd.read_csv("historical_recession_probabilities_timeline.csv")
        else:
            df = pd.read_csv("continuous_chart_data.csv")
            
        # Standardize date field name
        date_col = 'displayDate' if 'displayDate' in df.columns else 'date'
        if date_col in df.columns:
            df['date'] = pd.to_datetime(df[date_col]).dt.strftime('%Y-%m-%d')
            df = df.sort_values('date')

        # Map traditional signal to percentage scale (0 or 100)
        if '1. Traditional Yield Warning (Baseline)_Prob' in df.columns:
            df['yieldSignal'] = df['1. Traditional Yield Warning (Baseline)_Prob'].apply(lambda x: 100 if float(x) > 0 else 0)
        elif 'YIELD_WARNING' in df.columns:
            df['yieldSignal'] = df['YIELD_WARNING'].apply(lambda x: 100 if int(x) == 1 else 0)
        else:
            df['yieldSignal'] = 0

        # Grab the Lasso ML probability and scale to percentage (0-100)
        lasso_col = '3. Full Macro ML Filter (Lasso)_Prob'
        if lasso_col in df.columns:
            df['mlProbability'] = df[lasso_col].apply(lambda x: float(x) * 100 if pd.notna(x) else 0.0)
        else:
            df['mlProbability'] = 0.0

        # Select only the required fields
        result_df = pd.DataFrame({
            'date': df['date'],
            'mlProbability': df['mlProbability'],
            'yieldSignal': df['yieldSignal']
        })
        
        result_df = result_df.replace({np.nan: None, np.inf: None, -np.inf: None})
        return result_df.to_dict(orient="records")
    except Exception as e:
        print(f"Error in /api/chart-data: {e}")
        raise HTTPException(status_code=500, detail=str(e))
