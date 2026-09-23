import axios from 'axios';
import type {
  CurrentRiskResponse,
  ExplainabilityResponse,
  HistoricalEvent,
  ModelTrustMetrics,
  NberRecessionPeriod,
  ScenarioInputs,
  ScenarioResponse,
  TimelinePoint,
} from './types';

const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 40000,
});

// Track abort controllers by endpoint URL
const pendingControllers = new Map<string, AbortController>();

const getWithAbort = async (url: string) => {
  if (pendingControllers.has(url)) {
    pendingControllers.get(url)?.abort();
  }
  const controller = new AbortController();
  pendingControllers.set(url, controller);
  
  try {
    const response = await api.get(url, { signal: controller.signal });
    pendingControllers.delete(url);
    return response;
  } catch (error) {
    if (!axios.isCancel(error)) {
      pendingControllers.delete(url);
    }
    throw error;
  }
};

export const fetchCurrentRisk = async (): Promise<CurrentRiskResponse> => {
  const r: any = await api.get('/api/current-risk').catch(() => ({ data: {} }));
  const d = r?.data ?? {};
  return {
    yield_status: d?.yield_curve_status ?? d?.yield_status ?? 'UNKNOWN',
    yield_spread: Number(d?.yield_spread ?? 0),
    traditional_signal: d?.traditional_signal ?? 'UNKNOWN',
    traditional_probability: Number(d?.traditional_probability ?? 0),
    ml_assessment: d?.ml_assessment ?? '',
    confidence: d?.confidence ?? '',
    ml_probability: Number(d?.probability ?? d?.ml_probability ?? 0),
    historical_analogue: d?.historical_analogue ?? '',
  } as CurrentRiskResponse;
};

export async function fetchTimeline(): Promise<TimelinePoint[]> {
  const r = await api.get<any>('/api/chart-data');
  return r.data ?? [];
}

export const fetchHistoricalEvents = async (mode: 'canonical' | 'all' = 'canonical'): Promise<HistoricalEvent[]> => {
  const r = await api.get<any[]>(`/api/historical-events?mode=${mode}`);
  const raw = r.data ?? [];

  // try to enrich events with timeline values when available
  const tlResp = await api.get<any[]>('/api/timeline').catch(() => ({ data: [] }));
  const timeline = (tlResp && tlResp.data) || [];
  const timelineMap: Record<string, any> = {};
  for (const p of timeline) {
    const key = String(p.date).slice(0, 7); // YYYY-MM
    timelineMap[key] = p;
  }

  return raw.map((e: any, idx: number) => {
    const date = e.date ?? (e.year ? `${e.year}-01-01` : '1970-01-01');
    const id = e.id ?? `${date}-${(e.label ?? e.name ?? '').replace(/\s+/g, '-')}-${idx}`;
    const year = (e.year ?? parseInt(String(date).split('-')[0], 10)) || 1970;

    // lookup timeline match (month precision)
    const key = String(date).slice(0, 7);
    const tl = timelineMap[key];

    // timeline uses 'spread' (raw) and 'ml_probability' (percentage)
    const rawSpread = tl ? (tl.spread ?? tl.yield_spread ?? 0) : (e.yield_spread ?? 0);
    // backend now returns bps for yield_spread; if value is a small fraction (abs < 10) treat as proportion and multiply by 100
    const yieldSpreadBps = typeof rawSpread === 'number' && Math.abs(rawSpread) < 10 ? Number((rawSpread * 100).toFixed(2)) : Number((rawSpread).toFixed(2));

    const mlProb = tl ? (tl.ml_probability ?? tl.ml_prob ?? tl.probability ?? e.ml_probability ?? e.probability ?? 0) : (e.ml_probability ?? e.probability ?? 0);

    const yieldCurveSays = e.yield_curve_says ?? (yieldSpreadBps < 0 ? 'RECESSION WARNING' : 'NO WARNING');
    const modelAgrees = typeof e.model_agrees_with_yield_curve === 'boolean' ? e.model_agrees_with_yield_curve : (mlProb >= 50);

    // craft a short 'why' if backend didn't provide one
    const whyText = e.why ?? e.description ?? e.explanation ?? '';

    return {
      id: String(id),
      year,
      date: String(date),
      label: e.label ?? e.name ?? '',
      yield_inversion: !!e.yield_inversion,
      // present yield spread in bps with 2 decimals for UI
      yield_spread: yieldSpreadBps,
      yield_curve_says: yieldCurveSays,
      model_agrees_with_yield_curve: modelAgrees,
      why: whyText,
      ml_prediction: e.ml_prediction ?? (mlProb >= 75 ? 'VERY HIGH RISK' : mlProb >= 50 ? 'ELEVATED RISK' : 'LOW RISK'),
      ml_probability: mlProb,
      outcome: e.outcome ?? '',
      top_factors: e.top_factors ?? e.top_indicators ?? [],
      top_indicators: e.top_indicators ?? [],
      feature_values: (e as any).feature_values ?? {},
    } as HistoricalEvent;
  });
};

export const fetchNberRecessions = async (): Promise<NberRecessionPeriod[]> => {
  const r = await api.get<NberRecessionPeriod[]>('/api/nber-recessions');
  return r.data ?? [];
};

export const fetchExplainability = async (): Promise<ExplainabilityResponse> => {
  try {
    return {
      yield_curve_says: 'WARNING',
      ml_verdict: 'Elevated but filtered risk',
      final_probability: 0,
      positive_factors: [],
      negative_factors: [],
      waterfall: [],
    } as ExplainabilityResponse;
  } catch (error) {
    return {
      yield_curve_says: 'WARNING',
      ml_verdict: 'Loading...',
      final_probability: 0,
      positive_factors: [],
      negative_factors: [],
      waterfall: [],
    };
  }
};

export const fetchScenarioDefaults = async (): Promise<ScenarioInputs> => {
  const r = await api.get<ScenarioInputs>('/api/scenario/defaults');
  return r.data;
};

export const runScenario = async (inputs: ScenarioInputs & { overrides?: Record<string, number> }): Promise<ScenarioResponse> => {
  const r = await api.post<ScenarioResponse>('/api/scenario', inputs);
  return r.data;
};

export const fetchModelTrust = async (): Promise<ModelTrustMetrics> => {
  const r = await api.get<ModelTrustMetrics>('/api/model-trust');
  return r.data;
};

// Provide per-event explainability by deriving from the stored historical event data
export const fetchEventExplanation = async (eventId: string): Promise<any> => {
  const events = await fetchHistoricalEvents();
  const ev = events.find((e) => e.id === eventId) ?? events[0];
  if (!ev) return null;

  // Build a simple explainability structure from event.top_factors (real data sourced from backend)
  const contributions = (ev.top_factors ?? []).map((f) => ({
    name: f.name ?? 'unknown',
    prob_delta_pp: (f.impact ?? 0),
    direction: f.direction ?? (f.impact >= 0 ? 'positive' : 'negative'),
  }));

  const sumContrib = contributions.reduce((s, c) => s + (c.prob_delta_pp ?? 0), 0);
  const base_probability = Math.max(0, (ev.ml_probability ?? 0) - sumContrib);

  return {
    base_probability: base_probability / 100.0,
    probability: (ev.ml_probability ?? 0) / 100.0,
    pp_contributions: contributions,
    top_indicators: (ev.top_indicators ?? []).slice(0, 6),
  };
};

export type {
  CurrentRiskResponse,
  ExplainabilityResponse,
  HistoricalEvent,
  ModelTrustMetrics,
  NberRecessionPeriod,
  ScenarioInputs,
  ScenarioResponse,
  TimelinePoint,
  FactorContribution,
} from './types';
