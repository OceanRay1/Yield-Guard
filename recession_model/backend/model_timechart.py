import numpy as np
import pandas as pd
import pickle

print("--- GENERATING HISTORICAL TIME-SERIES PROBABILITY EXPORT ---")

# 1. Load trained models package
with open("trained_model_pipeline_output.pkl", "rb") as f:
  saved_package = pickle.load(f)
saved_models = saved_package["models"]

# 2. Load the master dataset containing all features and filter_active
df_master = pd.read_csv("continuous_chart_data.csv", index_col=0, parse_dates=True)
df_master.index = pd.to_datetime(df_master.index)
timeline_results = pd.DataFrame(index=df_master.index)

# 3. Generate continuous probability timelines for each model
for model_name, art in saved_models.items():
  scaler = art["scaler"]
  clf = art["clf"]
  mask = art["mask"]
  feature_cols = art["feature_cols"]

  # Extract features and fill missing values safely
  X_raw = df_master[feature_cols].fillna(0).values.astype(float)

  # Special handling for pure baseline rule
  if len(feature_cols) == 1 and feature_cols[0] == "YIELD_WARNING":
    probs = X_raw[:, 0] * 1.0  
  else:
    X_scaled = scaler.transform(X_raw)
    if art["auto_select"] and mask is not None:
      X_scaled = X_scaled[:, mask]
    # Get probability of class 1 (Crisis/Recession)
    probs = clf.predict_proba(X_scaled)[:, 1]

  timeline_results[f"{model_name}_Prob"] = probs.round(3)

# 4. Explicitly import filter_active and any other target flags into the results
if "filter_active" in df_master.columns:
  timeline_results["filter_active"] = df_master["filter_active"]

if "filter_target" in df_master.columns:
  timeline_results["Actual_Recession_Flag"] = df_master["filter_target"]

# 5. Format index to 'displayDate' column and export to CSV
timeline_results = timeline_results.reset_index()
timeline_results = timeline_results.rename(
    columns={timeline_results.columns[0]: "displayDate"}
)

output_filename = "historical_recession_probabilities_timeline.csv"
timeline_results.to_csv(output_filename, index=False)

print(
    f"\n[Success] Timeline successfully generated across"
    f" {len(timeline_results)} monthly periods."
)
print(f"Exported data saved to: {output_filename}")
print(timeline_results.tail(10))