import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fetchNberRecessions, fetchTimeline } from '../api/client';
import type { NberRecessionPeriod, TimelinePoint } from '../api/client';

function formatShortDate(d: string) {
  return String(d).slice(0, 7);
}

function yieldTextFromTraditional(val: number | undefined) {
  if (val == null) return 'Unknown';
  return Number(val) >= 50 ? 'RECESSION WARNING' : 'No warning';
}

function mlTextFromProb(val: number | undefined, isActive: boolean) {
  if (!isActive) return 'Model: Inactive (Dormant outside warning regime)';
  if (val == null) return 'Unknown';
  const n = Number(val);
  if (n >= 75) return 'Model: Very high risk';
  if (n >= 50) return 'Model: Elevated risk';
  if (n > 0) return 'Model: Low risk';
  return 'Model: No signal';
}

export function ProbabilityChart() {
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [recessions, setRecessions] = useState<NberRecessionPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchTimeline(), fetchNberRecessions()])
      .then(([t, r]) => {
        const sorted = (t || []).sort((a: any, b: any) => 
          new Date(a.displayDate || a.date).getTime() - new Date(b.displayDate || b.date).getTime()
        );
        setTimeline(sorted);
        setRecessions(r || []);
      })
      .catch((err) => {
        console.error('Failed to load timeline or recessions:', err);
      })
      .finally(() => setLoading(false));
  }, []);

const chartData = useMemo(() => {
    return timeline.map((p: any) => {
      const displayDate = p.date ?? p.displayDate;
      const traditional_pct = Number(Number(p.yieldSignal ?? p.traditional_pct ?? 0).toFixed(1));
      const raw_ml_pct = Number(Number(p.mlProbability ?? p.ml_pct ?? 0).toFixed(1));
      
      const filterActiveFlag = p.filter_active;
      const isWarningActive = 
        filterActiveFlag === true || 
        filterActiveFlag === 1 || 
        traditional_pct >= 50;

      const validProb = isFinite(raw_ml_pct) ? raw_ml_pct : 0;

      return {
        ...p,
        displayDate,
        traditional_pct: isFinite(traditional_pct) ? traditional_pct : 0,
        ml_pct: validProb,
        isWarningActive,
      };
    });
  }, [timeline]);

  // Calculate the target year/month for 1 month prior to today
  const targetDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1); // Subtract 1 month (e.g., August -> July)
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);

  const latestPoint = useMemo(() => {
    if (!chartData.length) return null;
    // Try to find the data point for 1 month ago
    const targetMatch = chartData.find(p => formatShortDate(p.date) === targetDate);
    // Fall back to the absolute latest available point if July isn't in your dataset yet
    return targetMatch || chartData[chartData.length - 1];
  }, [chartData, targetDate]);

  const recent = chartData.slice(Math.max(0, chartData.length - 8));

  if (loading) {
    return (
      <div className="h-[360px] flex items-center justify-center font-mono text-xs text-slate-500 animate-pulse">
        Loading probability timeline...
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <section className="bg-terminal-panel border border-terminal-border rounded-lg p-5 md:p-6 space-y-4">
        <div>
          <p className="text-[10px] font-mono text-terminal-accent uppercase tracking-[0.2em] mb-1">Model vs Traditional Signal</p>
          <h2 className="text-lg font-semibold text-white">Recession probability — no data</h2>
          <p className="text-xs text-slate-500 mt-1 font-mono">No timeline points were returned from the API.</p>
        </div>
      </section>
    );
  }

  return ( <section className="bg-[#0c0e14] border border-zinc-800 rounded-sm p-6 md:p-8 space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5 text-left">
            <span className="text-xs font-medium text-emerald-400 tracking-wide block">
              Model vs Traditional Signal
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100 tracking-tight">
              Recession probability, 1970–present
            </h2>
          </div>

          <div className="flex items-center gap-6 text-xs text-zinc-400 font-light">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
              <span>Traditional Yield Warning</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500/40"></span>
              <span>ML Filter Probability (Inactive Regime)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>ML Filter Probability (Active)</span>
            </div>
          </div>
        </div>
        
       <p className="text-xs md:text-sm text-zinc-400 font-light leading-relaxed">
  <span>
    Full History of model predictions for NBER recessions, classified by regime where the ML filter is active
  </span>
  <br />
  <span className="mt-1 block">
    <span className="font-bold [font-style:italic] text-zinc-300">Note: </span>
    <span>Data lagged ~2 months to align with official reporting and model training</span>
  </span>
</p>
      </div>

      <div className="h-[320px] w-full bg-zinc-950/40 border border-zinc-800/60 rounded-sm p-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            {recessions.map((r) => (
              <ReferenceArea
                key={`${r.start}-${r.end}-${r.label}`}
                x1={r.start}
                x2={r.end}
                fill="#f87171"
                fillOpacity={0.06}
                strokeOpacity={0}
              />
            ))}

            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="displayDate"
              type="category"
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              tickFormatter={(v: string) => String(v || '').slice(0, 7)}
              interval="preserveStartEnd"
              minTickGap={40}
              axisLine={{ stroke: '#27272a' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              tickFormatter={(v: number) => `${v}%`}
              width={45}
              axisLine={{ stroke: '#27272a' }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0c0e14',
                borderColor: '#27272a',
                borderRadius: '2px',
                color: '#f4f4f5',
                fontSize: '12px',
              }}
              labelFormatter={(label) => String(label)}
              formatter={(value: any, name, item) => {
                const numericVal = Number(value || 0).toFixed(1);
                const isWarningActive = item?.payload?.isWarningActive;
                if (name === 'Traditional Yield Warning') {
                  return [`${numericVal}%`, name];
                }
                const statusLabel = isWarningActive ? 'Active (Trained Regime)' : 'Dormant (Inactive Regime)';
                return [`${numericVal}% — ${statusLabel}`, 'ML Filter Probability'];
              }}
            />
            <Line
              type="stepAfter"
              dataKey="traditional_pct"
              name="Traditional Yield Warning"
              stroke="#f87171"
              strokeWidth={1.5}
              dot={false}
              opacity={0.7}
            />
            <Area
              type="monotone"
              dataKey="ml_pct"
              stroke="none"
              fill="#3b82f6"
              fillOpacity={0.10}
              connectNulls={true}
              legendType="none"
              tooltipType="none"
            />
            <Line
              type="monotone"
              dataKey="ml_pct"
              name="ML Filter Probability"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 1, fill: '#3b82f6' }}
              shape={(props: any) => {
                const { points } = props;
                if (!points || points.length === 0) return null;

                const segments: { path: string; active: boolean }[] = [];
                let currentPath = '';
                let currentActive = points[0]?.payload?.isWarningActive;

                points.forEach((pt: any, idx: number) => {
                  const isActive = pt.payload?.isWarningActive;
                  if (idx === 0) {
                    currentPath = `M ${pt.x},${pt.y}`;
                  } else {
                    if (isActive !== currentActive) {
                      segments.push({ path: currentPath, active: currentActive });
                      const prev = points[idx - 1];
                      currentPath = `M ${prev.x},${prev.y} L ${pt.x},${pt.y}`;
                      currentActive = isActive;
                    } else {
                      currentPath += ` L ${pt.x},${pt.y}`;
                    }
                  }
                });
                segments.push({ path: currentPath, active: currentActive });

                return (
                  <g>
                    {segments.map((seg, i) => (
                      <path
                        key={`line-seg-${i}`}
                        d={seg.path}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth={seg.active ? 2 : 1.5}
                        strokeDasharray={seg.active ? undefined : '3 3'}
                        opacity={seg.active ? 1 : 0.45}
                      />
                    ))}
                  </g>
                );
              }}
            />
            
          </ComposedChart>
        </ResponsiveContainer>
      </div>
              
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-zinc-800 items-start">
        <div className="lg:col-span-5 bg-zinc-950/80 border border-zinc-800 rounded-sm p-5 space-y-3">
          <span className="text-xs font-medium text-emerald-400 tracking-wide block">
            Latest timeline point 
          </span>
          {latestPoint ? (
            <div className="space-y-1.5 text-xs text-zinc-300 font-light">
              <p><strong className="text-zinc-100 font-medium">Date:</strong> {formatShortDate(latestPoint.date)}</p>
              <p><strong className="text-zinc-100 font-medium">Yield signal:</strong> {Number(latestPoint.traditional_pct ?? 0).toFixed(1)}%: <span className="font-semibold">{yieldTextFromTraditional(latestPoint.traditional_pct)}</span></p>
              <p><strong className="text-zinc-100 font-medium">ML probability:</strong> {Number(latestPoint.ml_pct ?? 0).toFixed(1)}%: <span className="font-semibold">{mlTextFromProb(latestPoint.ml_pct, latestPoint.isWarningActive)}</span></p>
            </div>
          ) : (
            <div className="text-xs text-zinc-500 font-light">No timeline data available</div>
          )}
        </div>

        <div className="lg:col-span-7 bg-zinc-950/80 border border-zinc-800 rounded-sm p-5 space-y-3">
          <span className="text-xs font-medium text-emerald-400 tracking-wide block">
            Recent timeline
          </span>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {recent.map((p, idx) => (
              <div key={`${p.date ?? 'na'}-${idx}`} className="bg-zinc-900/60 border border-zinc-800/80 rounded-sm p-2 text-center space-y-0.5">
                <p className="font-medium text-[10px] text-zinc-200">{formatShortDate(p.date)}</p>
                <div className="text-[10px] text-zinc-400 font-light">
                  Y: {Number(p.traditional_pct ?? 0).toFixed(0)}%
                </div>
                <div className="text-[10px] text-zinc-400 font-light flex items-center justify-center gap-0.5">
                  ML: {Number(p.ml_pct ?? 0).toFixed(0)}%{p.isWarningActive ? <span className="text-blue-400 text-[8px]">●</span> : <span className="text-zinc-600 text-[8px]">○</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}