import { useEffect, useState } from 'react';
import { fetchScenarioDefaults, runScenario, fetchHistoricalEvents } from '../api/client';
import type { ScenarioInputs } from '../api/client';

export function ScenarioSimulator() {
  const [inputs, setInputs] = useState<ScenarioInputs | null>(null);
  const [baseline, setBaseline] = useState<number | null>(null);
  const [scenario, setScenario] = useState<number | null>(null);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);

  const [tempFactors, setTempFactors] = useState<Array<{ name: string; raw: number; severity?: 'normal' | 'elevated' | 'severe' }>>([]);
  const [originalFactors, setOriginalFactors] = useState<Record<string, number>>({});

  const [historicalEventsList, setHistoricalEventsList] = useState<Array<{ date: string; label: string; ml_probability?: number; feature_values?: any; top_factors?: any }>>([]);
  const [selectedEventDate, setSelectedEventDate] = useState<string>('');

  const parseProbability = (val: any) => {
    if (val == null) return 0;
    const num = Number(val);
    if (isNaN(num)) return 0;
    return num <= 1 ? Math.round(num * 100) : Math.round(num);
  };

  const rawToDisplay = (fname: string, raw: number) => {
    if (raw == null || isNaN(raw)) return 0;

    if (fname.includes('SPREAD')) {
      return Math.abs(raw) < 10 ? raw * 100 : raw;
    }
    if (/YOY|GROWTH|PAYROLL|INDPRO|NONREV/i.test(fname)) {
      // Since your CSV stores growth rates as decimals (e.g. -0.0097 or 0.076),
      // multiplying by 100 turns them into readable percentages (-0.97 or 7.66).
      // Check if it's in the strict decimal range to avoid double-multiplying overrides:
      return Math.abs(raw) <= 1 ? raw * 100 : raw;
    }
    return Number(raw);
  };

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    fetchHistoricalEvents('canonical')
      .then((eventsRes) => {
        if (!mounted) return;
        if (eventsRes && Array.isArray(eventsRes) && eventsRes.length > 0) {
          setHistoricalEventsList(eventsRes);
          // dropdown default = 07 recession
          setSelectedEventDate(eventsRes[eventsRes.length - 3].date);
        }
      })
      .catch(() => { })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  const loadHistoricalEvent = async (targetDate: string) => {
    if (!targetDate) return;
    setLoading(true);
    try {
      const response: any = await fetchHistoricalEvents('canonical');

      // Handle various possible API response shapes (array vs wrapped object)
      const events = Array.isArray(response)
        ? response
        : (response?.events ?? response?.data ?? response?.items ?? []);

      if (!events || events.length === 0) {
        console.warn('No historical events returned from API');
        return;
      }

      setHistoricalEventsList(events);

      const selectedEvent = events.find((e: any) => e.date === targetDate) || events[events.length - 1];
      if (!selectedEvent) return;

      const eventProb = parseProbability(selectedEvent.ml_probability);
      setBaseline(eventProb);
      setScenario(eventProb);
      setExplanation('');

      const featureMap: Record<string, keyof ScenarioInputs> = {
        'SPREAD_10Y3M': 'yield_spread',
        'SPREAD_10Y2Y': 'yield_spread',
        'CREDIT_GROWTH_YOY': 'credit_growth',
        'NONREV_GROWTH_YOY': 'credit_growth',
        'INDPRO_YOY': 'industrial_production'
      };

      const base = inputs ? { ...inputs } : await fetchScenarioDefaults();
      const fv = selectedEvent.feature_values ?? {};
      const rawTops = selectedEvent.top_factors ?? [];
      const tops = rawTops.map((t: any) => (typeof t === 'string' ? { name: t } : t));

      const temp: Array<{ name: string; raw: number; severity?: 'normal' | 'elevated' | 'severe' }> = [];
      const initialOriginals: Record<string, number> = {};

      for (let i = 0; i < Math.min(4, tops.length); i++) {
        const fname = tops[i]?.name || tops[i]?.feature;
        if (!fname) continue;
        if (/PAYROLL|REAL_FED|FED_FUNDS/i.test(fname)) continue;
        const rawVal = typeof fv[fname] !== 'undefined' ? fv[fname] : 0;
        temp.push({ name: fname, raw: Number(rawVal), severity: 'elevated' });
        initialOriginals[fname] = Number(rawVal);
      }

      Object.keys(fv).forEach((fname) => {
        const mapped = featureMap[fname];
        if (!mapped) return;
        let val: number = fv[fname];

        if (fname === 'SPREAD_10Y3M' || fname === 'SPREAD_10Y2Y') {
          val = Number(val);
        } else if (/YOY|GROWTH|PAYROLL|NONREV/i.test(fname)) {
          val = Number(val);
        } else if (fname === 'REAL_FED_FUNDS') {
          val = Number(val);
        }
        (base as Record<string, number>)[mapped] = Number(Number(val).toFixed(mapped === 'yield_spread' ? 0 : 2));
      });

      setInputs(base);
      setTempFactors(temp);
      setOriginalFactors(initialOriginals);

    } catch (e) {
      console.error('Failed to load historical event', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSeverityChange = (fname: string, severity: 'normal' | 'elevated' | 'severe') => {
    if (loading) return;

    const pristineRaw = originalFactors[fname] ?? 0;

    // Calculate new raw based on severity offset from pristine
    let targetRaw = pristineRaw;
    if (severity === 'normal') targetRaw = pristineRaw * 0.8;
    if (severity === 'severe') targetRaw = pristineRaw * 1.2;
    // 'elevated' uses pristineRaw directly

    const updatedFactors = tempFactors.map(f => {
      if (f.name !== fname) return f;
      return { ...f, raw: targetRaw, severity };
    });

    setTempFactors(updatedFactors);

    // Build overrides: completely omit any factor set to 'elevated'
    const overrides: Record<string, number> = {};
    updatedFactors.forEach((t) => {
      if (t.severity !== 'elevated') {
        overrides[t.name] = t.raw;
      }
    });

    const payload = {
      target_date: selectedEventDate,
      overrides
    };

    setLoading(true);
    runScenario(payload)
      .then((result) => {
        if (result) {
          setScenario(parseProbability(result.scenario_probability));
        }
      })
      .catch((err) => {
        console.error('Scenario calculation failed:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };
  const getRiskColor = (value: number | null) => {
    if (value === null) return 'text-zinc-100';
    if (value >= 70) return 'text-red-400';      // High risk
    if (value >= 40) return 'text-amber-400';    // Medium risk
    return 'text-emerald-400';                   // Low risk
  };
  const delta = Number(((scenario ?? 0) - (baseline ?? 0)).toFixed(2));

  return (
    <section className="bg-[#0c0e14] border border-zinc-800 rounded-sm p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5 text-left">
          <span className="text-xs font-medium text-emerald-400 tracking-wide block">
            Scenario Testing
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
            Interact With Filter During Past Active Regimes
          </h2>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedEventDate}
            onChange={(e) => setSelectedEventDate(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 rounded-sm px-3 py-2 focus:outline-none focus:border-zinc-700 cursor-pointer flex-1 sm:flex-none font-light"
          >
            {historicalEventsList.map((ev) => (
              <option key={ev.date} value={ev.date} className="bg-[#0c0e14] text-zinc-200">
                {ev.date} — {ev.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              console.log("Load Event button clicked! Date:", selectedEventDate);
              loadHistoricalEvent(selectedEventDate);
            }}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load Event'}
          </button>
        </div>
      </div>

      {tempFactors.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-zinc-800">
          <span className="text-xs font-medium text-emerald-400 tracking-wide block">
            Select Factor Severity Levels
          </span>

          <div className="bg-zinc-950/60 border border-zinc-800/80 px-4 py-3 rounded-sm text-xs text-zinc-400 font-light">
            <strong className="text-zinc-200 font-medium">Note:</strong> Raw factor values are auto-scaled for model evaluation to prevent boundary lockups.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tempFactors.map((t) => {
              const displayVal = rawToDisplay(t.name, t.raw);

              return (
                <div key={t.name} className="bg-zinc-950/80 p-4 rounded-sm border border-zinc-800 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-200 font-medium truncate" title={t.name}>{t.name}</span>
                    <span className="text-emerald-400 font-medium">Val: {displayVal.toFixed(2)}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(['normal', 'elevated', 'severe'] as const).map((level) => {
                      const isActive = (t.severity ?? 'elevated') === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => handleSeverityChange(t.name, level)}
                          className={`py-1.5 px-2 text-[11px] uppercase tracking-wide rounded-sm border transition-colors cursor-pointer ${isActive
                              ? 'bg-emerald-500 text-zinc-950 border-emerald-500 font-bold shadow-sm'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 font-light'
                            }`}
                        >
                          {level}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-zinc-800 text-sm">
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-sm p-4 space-y-1">
          <span className="text-xs font-medium text-zinc-400 tracking-wide block">Baseline Risk</span>
          <span className={`text-lg font-bold tracking-tight ${getRiskColor(baseline)}`}>
            {baseline !== null ? `${baseline}%` : '---'}
          </span>
        </div>
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-sm p-4 space-y-1 col-span-2 md:col-span-1">
          <span className="text-xs font-medium text-zinc-400 tracking-wide block">Scenario Risk</span>
          <span className={`text-lg font-bold tracking-tight ${getRiskColor(scenario)}`}>
            {scenario !== null ? `${Math.max(1, Math.min(99, scenario))}%` : '---'}
          </span>
        </div>
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-sm p-4 space-y-1 col-span-2 md:col-span-1">
          <span className="text-xs font-medium text-zinc-400 tracking-wide block">Delta</span>
          <span className={`text-lg font-bold tracking-tight ${delta > 0 ? 'text-red-400' : delta < 0 ? 'text-emerald-400' : 'text-zinc-100'}`}>
            {delta > 0 ? `+${delta}%` : `${delta}%`}
          </span>
        </div>
      </div>

      {explanation && (
        <div className="text-xs text-zinc-300 font-light bg-zinc-950/80 p-4 rounded-sm border border-zinc-800 leading-relaxed">
          {explanation}
        </div>
      )}
    </section>
  );
}