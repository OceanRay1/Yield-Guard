export interface CurrentRiskResponse {
  yield_status: string;
  yield_spread: number;
  traditional_signal: string;
  traditional_probability: number;
  ml_assessment: string;
  confidence: string;
  ml_probability: number;
  historical_analogue: string;
}

export interface HistoricalEvent {
  id: string;
  year: number;
  date: string;
  label: string;
  yield_inversion: boolean;
  yield_spread: number;
  ml_prediction: string;
  ml_probability: number;
  outcome: string;
  top_factors: FactorContribution[];
  top_indicators: any[];
  // optional raw feature values keyed by model feature name (e.g. SPREAD_10Y3M)
  feature_values?: Record<string, number>;
}

export interface FactorContribution {
  name: string;
  impact: number;
  direction: 'positive' | 'negative';
}

export interface TimelinePoint {
  date: string;
  traditional_signal: number;
  ml_probability: number;
  yield_inverted: boolean;
  recession: boolean;
}

export interface NberRecessionPeriod {
  start: string;
  end: string;
  label: string;
}

export interface ExplainabilityResponse {
  yield_curve_says: string;
  ml_verdict: string;
  final_probability: number;
  positive_factors: FactorContribution[];
  negative_factors: FactorContribution[];
  waterfall: FactorContribution[];
}

export interface ScenarioInputs {
  yield_spread?: number;
  credit_growth?: number;
  payroll_growth?: number;
  industrial_production?: number;
  real_fed_funds?: number;
  // optional overrides keyed by model feature name (values in model units, e.g., 0.045 or -0.42)
  overrides?: Record<string, number>;
}

export interface ScenarioResponse {
  baseline_probability: number;
  scenario_probability: number;
  explanation: string;
}

export interface ModelTrustMetrics {
  pr_auc: number;
  precision: number;
  recall: number;
  f1: number;
  brier_score: number;
  precision_ci: [number, number];
  recall_ci: [number, number];
  calibration: { predicted: number; actual: number }[];
  confusion_matrix: {
    true_negatives: number;
    false_positives: number;
    false_negatives: number;
    true_positives: number;
  };
}
