import { useEffect, useState } from 'react';
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts';
import { fetchModelTrust } from '../api/client';
import type { ModelTrustMetrics } from '../api/client';

export function ModelTrustPanel() {
  const [metrics, setMetrics] = useState<ModelTrustMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModelTrust()
      .then(setMetrics)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center font-mono text-xs text-slate-500 animate-pulse">
        Loading validation metrics...
      </div>
    );
  }

  if (!metrics) return null;

  const calibrationData = (metrics.calibration ?? []).map((c: any) => ({
    predicted: c.predicted ?? 0,
    actual: c.actual ?? 0,
  }));

  const f1Value = (metrics as any).f1 ?? (metrics as any).f1_score ?? 0;
  const precisionCi = metrics.precision_ci ?? [metrics.precision ?? 0, metrics.precision ?? 0];
  const recallCi = metrics.recall_ci ?? [metrics.recall ?? 0, metrics.recall ?? 0];
  console.log("Calibration Data rendered:", calibrationData);
  return (
    <div className="space-y-6">
      <div className="max-w-3xl space-y-1.5 text-left">
        <span className="text-xs font-medium text-emerald-400 tracking-wide block">
          Model Trust & Validation
        </span>
        <h1 className="text-2xl md:text-3xl font-bold text-zinc-100 tracking-tight">
          Demystifying what's otherwise a black box
        </h1>
        <p className="text-sm text-zinc-400 font-light leading-relaxed">
          Developed utilizing walk-forward validation on historical yield inversion episodes. Because recessions
          are rare events, there is an inherent margin of error for all provided metrics.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="PR-AUC" value={(metrics.pr_auc ?? 0).toFixed(3)} />
        <MetricCard label="Precision" value={`${((metrics.precision ?? 0) * 100).toFixed(1)}%`} />
        <MetricCard label="Recall" value={`${((metrics.recall ?? 0) * 100).toFixed(1)}%`} />
        <MetricCard label="F1 Score" value={f1Value.toFixed(3)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-[#0c0e14] border border-zinc-800 rounded-sm p-6 space-y-4">
          <div className="space-y-1 text-left">
            <h2 className="text-base font-bold text-zinc-100 tracking-tight">Calibration Curve</h2>
            <p className="text-xs text-zinc-400 font-light">
              Predicted vs realized recession frequency (perfect calibration follows the diagonal)
            </p>
          </div>
          <div className="h-[280px] bg-zinc-950/40 border border-zinc-800/60 rounded-sm p-4 pb-6">
            <ResponsiveContainer width="100%" height="135%">
              <LineChart data={calibrationData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis
                  dataKey="predicted"
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  axisLine={{ stroke: '#27272a' }}
                  tickLine={false}
                  label={{
                    value: 'Predicted %',
                    position: 'insideBottom',
                    offset: -15,
                    fill: '#a1a1aa',
                    fontSize: 11,
                  }}
                />
                <YAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  axisLine={{ stroke: '#27272a' }}
                  tickLine={false}
                  label={{
                    value: 'Actual %',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#a1a1aa',
                    fontSize: 11,
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0c0e14',
                    borderColor: '#27272a',
                    borderRadius: '2px',
                    color: '#f4f4f5',
                    fontSize: '12px',
                  }}
                />
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: 100, y: 100 },
                  ]}
                  stroke="#52525b"
                  strokeDasharray="4 4"
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  name="Actual"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-[#0c0e14] border border-zinc-800 rounded-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-zinc-100 tracking-tight">Uncertainty & Discrimination</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-zinc-950/80 rounded-sm border border-zinc-800 p-4 space-y-1 flex flex-col items-center justify-center text-center">
              <p className="text-zinc-400 font-medium uppercase tracking-wider text-[10px]">Brier Score</p>
              <p className="text-zinc-100 text-xl font-bold tracking-tight">{(metrics.brier_score ?? 0).toFixed(3)}</p>
              <p className="text-zinc-500 text-[10px] font-light">Lower is better</p>
            </div>
            <div className="bg-zinc-950/80 rounded-sm border border-zinc-800 p-4 space-y-1 flex flex-col items-center justify-center text-center">
              <p className="text-zinc-400 font-medium uppercase tracking-wider text-[10px]">Bootstrap CI (95%)</p>
              <div className="text-zinc-300 font-light text-xs space-y-0.5">
                <p>Precision: <span className="font-bold text-zinc-100">{((metrics.precision ?? 0) * 100).toFixed(1)}%</span> <span className="text-zinc-500">({((precisionCi[0] ?? 0) * 100).toFixed(1)}%–{((precisionCi[1] ?? 0) * 100).toFixed(1)}%)</span></p>
                <p>Recall: <span className="font-bold text-zinc-100">{((metrics.recall ?? 0) * 100).toFixed(1)}%</span> <span className="text-zinc-500">({((recallCi[0] ?? 0) * 100).toFixed(1)}%–{((recallCi[1] ?? 0) * 100).toFixed(1)}%)</span></p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-300">Confusion Matrix (Walk-Forward)</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Cell
                label="True Negatives"
                sub="False alarms filtered"
                value={metrics.confusion_matrix?.true_negatives ?? 0}
                color="text-emerald-400"
              />
              <Cell
                label="False Positives"
                sub="Missed soft landings"
                value={metrics.confusion_matrix?.false_positives ?? 0}
                color="text-red-400"
              />
              <Cell
                label="False Negatives"
                sub="Crises missed"
                value={metrics.confusion_matrix?.false_negatives ?? 0}
                color="text-amber-400"
              />
              <Cell
                label="True Positives"
                sub="Crises caught"
                value={metrics.confusion_matrix?.true_positives ?? 0}
                color="text-emerald-400"
              />
            </div>
          </div>
        </section>
      </div>

      <section className="bg-[#0c0e14] border border-zinc-800 rounded-sm p-6 text-xs text-zinc-400 font-light leading-relaxed space-y-3">
        <p className="text-zinc-100 text-sm font-bold tracking-tight">Validation Methodology</p>
        <ul className="space-y-2 list-disc list-inside">
          <li>
            <strong className="text-zinc-200 font-medium">Stage-2 filter:</strong> Trained only on months where the yield curve triggered a warning (10Y–3M spread &lt; 25 bps)
          </li>
          <li>
            <strong className="text-zinc-200 font-medium">Walk-forward expanding window:</strong> Before each prediction, the model retrains using all prior warning-period observations
          </li>
          <li>
            <strong className="text-zinc-200 font-medium">Threshold optimization:</strong> Maximizes precision subject to recall ≥ 70% on a validation fold
          </li>
          <li>
            <strong className="text-zinc-200 font-medium">Feature selection:</strong> Lasso removes noisy macro indicators; ElasticNet regularization improves model stability
          </li>
          <li>
            <strong className="text-zinc-200 font-medium">Anti-leakage:</strong> All features are lagged one month before training to prevent look-ahead bias
          </li>
        </ul>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0c0e14] border border-zinc-800 rounded-sm p-4 text-center space-y-1">
      <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">{label}</p>
      <p className="text-xl text-zinc-100 font-bold tracking-tight">{value}</p>
    </div>
  );
}

function Cell({
  label,
  sub,
  value,
  color,
}: {
  label: string;
  sub: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-zinc-950/80 rounded-sm border border-zinc-800 p-3.5 space-y-1 flex flex-col items-center justify-center text-center">
      <p className="text-zinc-400 text-[10px] font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${color}`}>{value}</p>
      <p className="text-zinc-500 text-[10px] font-light">{sub}</p>
    </div>
  );
}