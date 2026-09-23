import pickle
import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.metrics import brier_score_loss, precision_score, recall_score

# 1. Load the saved pipeline package
with open("trained_model_pipeline_output.pkl", "rb") as f:
    output_package = pickle.load(f)

raw_outputs = output_package["raw_outputs"]
evaluation_results = output_package["evaluation_results"]

print("=" * 90)
print(f"{'ADVANCED METRIC EVALUATION & TRUST MODULE':^90}")
print("=" * 90)

# 1. Calibration Curve & Brier Score 
print("\n--- 1. PROBABILITY CALIBRATION & BRIER SCORES ---")
print("Goal: Check if a predicted 80% recession probability actually happens ~80% of the time.")

calibration_metrics = {}
for model_name, outputs in raw_outputs.items():
    y_true = np.array(outputs["true"])
    y_prob = np.array(outputs["prob"])
    
    # Compute Brier Score (lower is better, 0 = perfect)
    brier = brier_score_loss(y_true, y_prob)
    
    # Compute Reliability Diagram / Calibration Curve bins
    fraction_of_positives, mean_predicted_value = calibration_curve(y_true, y_prob, n_bins=8, strategy='uniform')
    
    calibration_metrics[model_name] = {
        "brier_score": brier,
        "mean_predicted": mean_predicted_value,
        "fraction_of_positives": fraction_of_positives
    }
    
    print(f"\nModel: {model_name}")
    print(f"  -> Brier Score: {brier:.4f}")
    print("  -> Reliability Diagram Mapping (Predicted vs Actual Frequency):")
    for pred_bin, actual_bin in zip(mean_predicted_value, fraction_of_positives):
        print(f"     Predicted: {pred_bin*100:.1f}%  ==>  Actual Realized: {actual_bin*100:.1f}%")


# 2. Bootstrap confidence intervals
print("\n--- 2. BOOTSTRAP CONFIDENCE INTERVALS (95% CI) ---")
print("Goal: Honest bounds for small macro sample sizes via resampling.")

n_bootstraps = 1000
np.random.seed(42)

bootstrap_summary = {}
for model_name, outputs in raw_outputs.items():
    y_true = np.array(outputs["true"])
    y_pred = np.array(outputs["pred"])
    
    precisions, recalls = [], []
    n_samples = len(y_true)
    
    for _ in range(n_bootstraps):
        indices = np.random.choice(n_samples, size=n_samples, replace=True)
        boot_true = y_true[indices]
        boot_pred = y_pred[indices]
        
        # Avoid division by zero crash in extreme bootstrap slices
        if len(np.unique(boot_true)) > 1:
            precisions.append(precision_score(boot_true, boot_pred, zero_division=0))
            recalls.append(recall_score(boot_true, boot_pred, zero_division=0))
            
    p_ci = np.percentile(precisions, [2.5, 97.5]) if precisions else [0, 0]
    r_ci = np.percentile(recalls, [2.5, 97.5]) if recalls else [0, 0]
    
    bootstrap_summary[model_name] = {
        "precision_ci": p_ci,
        "recall_ci": r_ci
    }
    
    print(f"\nModel: {model_name}")
    print(f"  -> Precision: {evaluation_results[model_name]['Precision']*100:.1f}% | 95% CI: [{p_ci[0]*100:.1f}%, {p_ci[1]*100:.1f}%]")
    print(f"  -> Recall:    {evaluation_results[model_name]['Recall']*100:.1f}%    | 95% CI: [{r_ci[0]*100:.1f}%, {r_ci[1]*100:.1f}%]")


# 3. Historical probability timeline comparison 
print("\n--- 3. HISTORICAL PROBABILITY TIMELINE (CRISIS INSPECTION) ---")
print("Frontend-Ready View: Comparing Yield Warning Baseline vs. Full Macro ML Filter during major crunch events.")

# Reload dataset to map dates back
df_timeline = pd.read_csv("yield_curve_filter_data.csv", index_col=0, parse_dates=True)

# Align raw outputs with dates in data index
warning_dates = df_timeline.index.sort_values()
min_train_size = 30
valid_dates = warning_dates[min_train_size:]

timeline_records = []
for idx, date_val in enumerate(valid_dates[:len(raw_outputs[list(raw_outputs.keys())[0]]["true"])]):
    row_data = {
        "Date": date_val.strftime("%Y-%m"),
        "Actual_Recession_12m": df_timeline.loc[date_val, 'target_recession_12m'],
        "Yield_Warning": df_timeline.loc[date_val, 'YIELD_WARNING']
    }
    for model_name, outputs in raw_outputs.items():
        if idx < len(outputs["prob"]):
            row_data[f"{model_name}_Prob"] = outputs["prob"][idx]
            row_data[f"{model_name}_Pred"] = outputs["pred"][idx]
    timeline_records.append(row_data)

timeline_df = pd.DataFrame(timeline_records)

# Filter for key historical crunch windows (e.g., Dot-Com 2000-2001 and Global Financial Crisis 2007-2008)
crisis_windows = timeline_df[
    (timeline_df['Date'].str.startswith('2000')) | 
    (timeline_df['Date'].str.startswith('2001')) | 
    (timeline_df['Date'].str.startswith('2007')) | 
    (timeline_df['Date'].str.startswith('2008')) |
    (timeline_df['Date'].str.startswith('2020'))
]

print("\nSample Historical Timeline Extraction (Dot-Com & GFC Crunches):")
print(crisis_windows[['Date', 'Yield_Warning', 'Actual_Recession_12m']].to_string())

print("=" * 90)

# 4. Model Explainability (Drive & Shift analysis)
print("\n--- 4. MODEL EXPLAINABILITY & DRIVER ANALYSIS ---")
print("Goal: Explain why a model's recession probability shifted during key economic windows.")

def explain_prediction_shift(model_name, date_t1, date_t2, df_data, artifacts_dict):
    """
    Computes linear coefficient-weighted feature contributions to explain 
    why the recession probability changed between two specific months, with absolute NaN protection.
    """
    if model_name not in artifacts_dict:
        print(f"Model {model_name} artifacts not found.")
        return

    art = artifacts_dict[model_name]
    scaler = art["scaler"]
    clf = art["clf"]
    mask = art["mask"]
    feature_cols = art["feature_cols"]

    # Extract data, ensure all feature columns exist, and fill any NaNs with 0
    row1_df = df_data.loc[[date_t1]][feature_cols].fillna(0)
    row2_df = df_data.loc[[date_t2]][feature_cols].fillna(0)

    row1 = row1_df.values.astype(float)
    row2 = row2_df.values.astype(float)

    # Special handling for pure rule-based baseline model with 1 feature
    if len(feature_cols) == 1 and feature_cols[0] == 'YIELD_WARNING':
        p1 = float(row1_df['YIELD_WARNING'].values[0]) * 100
        p2 = float(row2_df['YIELD_WARNING'].values[0]) * 100
        print(f"\n[Explanation for {model_name}]")
        print(f"Timeline Shift: {date_t1.strftime('%Y-%m')} ({p1:.1f}%)  ==>  {date_t2.strftime('%Y-%m')} ({p2:.1f}%)")
        print("  -> Pure rule-based indicator (No linear regression weights to decompose).")
        return

    # Scale and apply feature selection mask safely
    r1_scaled = scaler.transform(row1)
    r2_scaled = scaler.transform(row2)
    
    if art["auto_select"] and mask is not None:
        r1_scaled = r1_scaled[:, mask]
        r2_scaled = r2_scaled[:, mask]
        active_features = [f for f, m in zip(feature_cols, mask) if m]
    else:
        active_features = feature_cols

    # Get coefficients
    coefs = clf.coef_[0]

    # Calculate net feature contribution changes (Coefficient * Delta Scaled Value)
    delta_scaled = r2_scaled[0] - r1_scaled[0]
    contributions = coefs * delta_scaled

    # Map back to feature names
    impact_df = pd.DataFrame({
        'Feature': active_features,
        'Impact': contributions
    }).sort_values(by='Impact', ascending=False)

    # Calculate probabilities for context
    prob1 = clf.predict_proba(r1_scaled)[0, 1] * 100
    prob2 = clf.predict_proba(r2_scaled)[0, 1] * 100

    print(f"\n[Explanation for {model_name}]")
    print(f"Timeline Shift: {date_t1.strftime('%Y-%m')} ({prob1:.1f}%)  ==>  {date_t2.strftime('%Y-%m')} ({prob2:.1f}%)")
    print("Top Drivers pushing probability UP:")
    print(impact_df.head(3).to_string(index=False))
    print("\nTop Drivers pushing probability DOWN:")
    print(impact_df.tail(3).to_string(index=False))

# Execution for explainability 
with open("trained_model_pipeline_output.pkl", "rb") as f:
    saved_package = pickle.load(f)
saved_models = saved_package["models"]


df_all = pd.read_csv("yield_curve_filter_data.csv", index_col=0, parse_dates=True)

# Select a true structural shift: Pre-crisis environment vs Peak Financial Crisis crunch
sample_date_stable = pd.to_datetime("2006-06-01")
sample_date_crunch = pd.to_datetime("2008-09-01")

for model_name, artifact in saved_models.items():
    print(f"\n{'='*20} Feature Importance for: {model_name} {'='*20}")
    
    clf = artifact["clf"]
    mask = artifact["mask"]
    feature_cols = artifact["feature_cols"]
    auto_select = artifact["auto_select"]
    
    # Handle feature alignment if auto_select (L1 mask) was enabled
    if auto_select and mask is not None:
        active_features = np.array(feature_cols)[mask]
    else:
        active_features = np.array(feature_cols)
        
    # Extract coefficients from the Logistic Regression model
    coefficients = clf.coef_[0]
    
    # Create a DataFrame to rank features by absolute magnitude
    importance_df = pd.DataFrame({
        'Feature': active_features,
        'Coefficient': coefficients,
        'Abs_Coefficient': np.abs(coefficients)
    }).sort_values(by='Abs_Coefficient', ascending=False)
    
    print(importance_df.to_string(index=False))