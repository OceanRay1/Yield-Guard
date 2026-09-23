import pickle
import numpy as np
import pandas as pd
import warnings
from sklearn.exceptions import ConvergenceWarning
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    precision_recall_curve, 
    average_precision_score, 
    precision_score, 
    recall_score, 
    f1_score,
    roc_auc_score
)

# Suppress sklearn convergence warnings cleanly
warnings.filterwarnings("ignore", category=ConvergenceWarning)

# Toggle Test Mode
TEST_MODE = "warnings_only" 

if TEST_MODE == "warnings_only":
    dataset_filename = "yield_curve_filter_data.csv"
    target_column = "filter_target"
    print("\n--- RUNNING MODE: Stage-2 Yield Warning Filter (False Alarm Minimization) ---")
else:
    dataset_filename = "all_months_recession_data.csv"
    target_column = "target_all_months"
    print("\n--- RUNNING MODE: All Months Historically (Recession Prediction) ---")

# 1. Load Data
final_df = pd.read_csv(dataset_filename, index_col=0, parse_dates=True)
final_df = final_df.loc[:, ~final_df.columns.duplicated(keep='first')]

# 2. Define Features (Including YIELD_WARNING and YIELD_INVERSION)
universal_pool = [
    'YIELD_WARNING', 'YIELD_INVERSION', 'SPREAD_10Y3M', 'SPREAD_10Y2Y', 'FED_FUNDS_CHANGE', 'PAYROLL_YOY',
    'INCOME_YOY', 'OVERTIME_YOY', 'INDPRO_YOY', 'MANUF_YOY',
    'TCU_CHANGE', 'OIL_YOY', 'PPI_YOY', 'HOUSING_YOY', 'PERMIT_YOY',
    'CFNAI_MA3', 'M2_GROWTH_YOY', 'CREDIT_GROWTH_YOY',
    'NONREV_GROWTH_YOY', 'BUS_LOAN_YOY', 'CPI_YOY', 'PCE_YOY', 'SENTIMENT_YOY',
    'MONETARY_VELOCITY', 'HOUSING_MOMENTUM_INFLECTION',
    'SPREAD_INVERSION_MAGNITUDE', 'CREDIT_CRUNCH_INTERACTION',
    'PAYROLL_ACCELERATION', 'INDPRO_ACCELERATION',
    'LIQUIDITY_PRESSURE', 'TCU_PEAK_DISTANCE', 'CONSUMER_DIVERGENCE',
    'REAL_FED_FUNDS', 'REAL_FED_FUNDS_ACCEL', 
    'CREDIT_ACCELERATION', 'POLICY_OVERTIGHTENING'
]

# 3. Model Feature Groups Comparing Traditional Rule vs ML Filters
feature_groups = {
    "1. Traditional Yield Warning (Baseline)": [
        'YIELD_WARNING'
    ],
    "2. Yield Warning + Credit Filter": [
        'YIELD_WARNING',
        'CREDIT_GROWTH_YOY',
        'CREDIT_CRUNCH_INTERACTION',
        'CREDIT_ACCELERATION'
    ],
    "3. Full Macro ML Filter (Lasso)": universal_pool
}

model_definitions = {}
for name, cols in feature_groups.items():
    clean_cols = list(dict.fromkeys(cols))
    is_auto = ('Lasso' in name)
    model_definitions[name] = {
        'cols': clean_cols, 
        'dynamic_threshold': True, 
        'auto_select': is_auto
    }

all_cols = list(set([col for defs in model_definitions.values() for col in defs['cols']])) + [target_column]
data = final_df[all_cols].dropna()

# Pipeline Functions

def train_model(X, y, auto_select):
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    if auto_select and X_scaled.shape[1] > 1:
        # L1 feature selection to drop noisy indicators and keep precision high
        selector_clf = LogisticRegression(penalty='l1', solver='saga', C=11, max_iter=3000, class_weight='balanced', random_state=42)
        selector_clf.fit(X_scaled, y)
        mask = selector_clf.coef_[0] != 0
        if np.sum(mask) > 0:
            X_scaled = X_scaled[:, mask]
        else:
            mask = np.ones(X_scaled.shape[1], dtype=bool)
    else:
        mask = np.ones(X_scaled.shape[1], dtype=bool)
            
    # ElasticNet classifier focused on stabilizing false-positive suppression
    clf = LogisticRegression(penalty='elasticnet', l1_ratio=0.5, C=1, solver='saga', max_iter=4000, class_weight='balanced', random_state=42)
    clf.fit(X_scaled, y)
    
    return scaler, mask, clf

def select_threshold(val_clf, X_val_scaled, y_val, is_dynamic):
    if not is_dynamic or len(np.unique(y_val)) < 2:
        return 0.50
        
    val_probs = val_clf.predict_proba(X_val_scaled)[:, 1]
    p_vals, r_vals, thresholds = precision_recall_curve(y_val, val_probs)

    best_threshold = 0.50
    best_precision = -1.0
    
    # Check evaluated precision-recall thresholds from the curve
    for i, threshold in enumerate(thresholds):
        # p_vals and r_vals align with thresholds; length of thresholds is len(p_vals) - 1
        precision = p_vals[i]
        recall = r_vals[i]
        # optimize false+ reducation while keeping recall above 70%
        if recall >= 0.70 and precision > best_precision:
            best_precision = precision
            best_threshold = threshold

    # Fallback safety: if no threshold on the curve hits >= 70% recall, 
    # relax recall to avoid breaking execution
    if best_precision == -1.0:
        f1_scores = 2 * (p_vals * r_vals) / (p_vals + r_vals + 1e-10)
        if len(thresholds) > 0 and np.max(f1_scores) > 0:
            return thresholds[np.argmax(f1_scores)]
        return 0.50

    return best_threshold

def predict(test_sample, scaler, mask, clf, threshold, feature_cols, auto_select):
    X_test = test_sample[feature_cols].values
    X_test_scaled = scaler.transform(X_test)
    
    if auto_select and mask is not None:
        X_test_scaled = X_test_scaled[:, mask]
        
    # If evaluating a pure baseline single-feature rule like YIELD_WARNING alone:
    if len(feature_cols) == 1 and feature_cols[0] == 'YIELD_WARNING':
        raw_val = test_sample['YIELD_WARNING'].values[0]
        return float(raw_val), int(raw_val)

    prob = clf.predict_proba(X_test_scaled)[0, 1]
    pred = 1 if prob >= threshold else 0
    return prob, pred

# Main Execution Guard
if __name__ == "__main__":
    results = {}
    model_raw_outputs = {}  
    saved_models_artifacts = {}

    print("\n--- RUNNING STAGE-2 FILTER EVALUATION PIPELINE ---")

    for model_name, config in model_definitions.items():
        feature_cols = config['cols']
        is_dynamic = config.get('dynamic_threshold', False)
        auto_select = config.get('auto_select', False)
        
        model_probs, model_true, model_preds = [], [], []
        
        warning_dates = data.index.sort_values()
        min_train_size = 30 # Ensure stable history window for expansion
        if len(warning_dates) <= min_train_size:
            print(f"Not enough data points for {model_name}")
            continue
            
        for i in range(min_train_size, len(warning_dates)):
            split_date = warning_dates[i]
            
            history_data = data[data.index < split_date]
            test_data = data[data.index == split_date]
            
            if len(history_data) < 15 or len(test_data) == 0:
                continue
                
            val_split_idx = int(len(history_data) * 0.8)
            train_data = history_data.iloc[:val_split_idx]
            val_data = history_data.iloc[val_split_idx:]
            
            y_train = train_data[target_column].astype(int)
            y_val = val_data[target_column].astype(int)
            y_test = test_data[target_column].astype(int)

            if len(np.unique(y_train)) < 2 or len(y_test) == 0:
                continue

            X_train = train_data[feature_cols].values
            X_val = val_data[feature_cols].values

            scaler_tune, mask_tune, clf_tune = train_model(X_train, y_train, auto_select)
            X_val_scaled = scaler_tune.transform(X_val)
            if auto_select and mask_tune is not None:
                X_val_scaled = X_val_scaled[:, mask_tune]

            best_threshold = select_threshold(clf_tune, X_val_scaled, y_val, is_dynamic)
            
            X_full = history_data[feature_cols].values
            y_full = history_data[target_column].astype(int)
            
            scaler_final, mask_final, clf_final = train_model(X_full, y_full, auto_select)
            
            prob, pred = predict(test_data, scaler_final, mask_final, clf_final, best_threshold, feature_cols, auto_select)
            
            model_probs.append(prob)
            model_true.append(y_test.values[0])
            model_preds.append(pred)
            
        if len(model_probs) == 0 or len(np.unique(model_true)) < 2:
            continue
            
        cm = pd.crosstab(pd.Series(model_true), pd.Series(model_preds))
        cm_array = np.zeros((2, 2))
        for r_idx, r_val in enumerate([0, 1]):
            for c_idx, c_val in enumerate([0, 1]):
                if r_val in cm.index and c_val in cm.columns:
                    cm_array[r_idx, c_idx] = cm.loc[r_val, c_val]
        tn, fp, fn, tp = cm_array.ravel()

        results[model_name] = {
            "ROC-AUC": roc_auc_score(model_true, model_probs),
            "PR-AUC": average_precision_score(model_true, model_probs),
            "Precision": precision_score(model_true, model_preds, zero_division=0),
            "Recall": recall_score(model_true, model_preds, zero_division=0),
            "F1": f1_score(model_true, model_preds, zero_division=0),
            "True Negatives": int(tn),
            "False Positives": int(fp),
            "False Negatives": int(fn),
            "True Positives": int(tp)
        }

        model_raw_outputs[model_name] = {
            "true": model_true,
            "pred": model_preds,
            "prob": model_probs
        }

        X_all_final = data[feature_cols].values
        y_all_final = data[target_column].astype(int)
        val_split_idx_final = int(len(data) * 0.8)
        
        scaler_prod, mask_prod, clf_prod = train_model(X_all_final[:val_split_idx_final], y_all_final[:val_split_idx_final], auto_select)
        X_val_prod_scaled = scaler_prod.transform(X_all_final[val_split_idx_final:])
        if auto_select and mask_prod is not None:
            X_val_prod_scaled = X_val_prod_scaled[:, mask_prod]
        prod_threshold = select_threshold(clf_prod, X_val_prod_scaled, y_all_final[val_split_idx_final:], is_dynamic)
        
        scaler_final_all, mask_final_all, clf_final_all = train_model(X_all_final, y_all_final, auto_select)

        saved_models_artifacts[model_name] = {
            "scaler": scaler_final_all,
            "mask": mask_final_all,
            "clf": clf_final_all,
            "threshold": prod_threshold,
            "feature_cols": feature_cols,
            "auto_select": auto_select
        }

    output_package = {
        "models": saved_models_artifacts,
        "evaluation_results": results,
        "raw_outputs": model_raw_outputs
    }

    with open("trained_model_pipeline_output.pkl", "wb") as f:
        pickle.dump(output_package, f)

    print("\n[INFO] Successfully saved models, metrics, and raw outputs to 'trained_model_pipeline_output.pkl'")

    print("=" * 130)
    print(f"{'Model Group Name':<38} | {'ROC-AUC':<8} | {'PR-AUC':<7} | {'Precision':<10} | {'Recall':<7} | {'F1-Score':<8}")
    print("-" * 130)
    for name, metrics in results.items():
        print(f"{name:<38} | {metrics['ROC-AUC']:<8.4f} | {metrics['PR-AUC']:<7.4f} | {metrics['Precision']:<10.4f} | {metrics['Recall']:<7.4f} | {metrics['F1']:<8.4f}")
    print("=" * 130)

    for name, metrics in results.items():
        print(f"\n--- Confusion Matrix & Performance for {name} ---")
        print(f"True Negatives (Soft Landings/False Alarms Filtered Out): {metrics['True Negatives']}")
        print(f"False Positives (False Alarms Mistaken for Crises):     {metrics['False Positives']}")
        print(f"False Negatives (Real Crises Missed / Filtered Out):    {metrics['False Negatives']}")
        print(f"True Positives  (Real Crises Successfully Caught):      {metrics['True Positives']}")