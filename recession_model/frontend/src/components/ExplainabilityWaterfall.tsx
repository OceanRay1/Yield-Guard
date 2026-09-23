import React from 'react';

export default function ExplainabilityWaterfall({
  baseProbabilityPct,
  contributions,
  topN = 6,
}: {
  // baseProbabilityPct: percentage (0-100) representing base model probability before contributions
  baseProbabilityPct?: number | null;
  contributions: Array<{ name: string; prob_delta_pp: number }> | null | undefined; // prob_delta_pp is in percent points (e.g., 1.2 means +1.2 pp)
  topN?: number;
}) {
  const items = (contributions || [])
    .slice()
    .sort((a, b) => Math.abs(b.prob_delta_pp) - Math.abs(a.prob_delta_pp))
    .slice(0, topN);

  const basePct = typeof baseProbabilityPct === 'number' && !isNaN(baseProbabilityPct) ? baseProbabilityPct : 0;

  // prepare cumulative sequence (all in percent points)
  let cumulative = basePct;
  const rows = items.map((it) => {
    const change = (it.prob_delta_pp ?? 0); // already in percent points
    const before = cumulative;
    const after = before + change;
    cumulative = after;
    return { ...it, change, before, after };
  });

  const maxBar = Math.max(...rows.map((r) => Math.abs(r.change)), 1e-6);

  return (
    <div className="mt-4">
      <h4 className="font-mono text-[12px] text-slate-300 mb-2">BuildX Explainability — Risk Contribution Waterfall</h4>
      <div className="text-xs font-mono text-slate-400 mb-2">Base: {basePct !== null ? `${basePct.toFixed(1)}%` : 'N/A'} — shows how top factors moved probability</div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-3">
            <div className="w-44 text-slate-300 text-[13px] truncate">{r.name}</div>

            <div className="flex-1 bg-terminal-bg/30 rounded h-4 relative overflow-hidden">
              {/* center origin line at zero-change; positive grows to the right, negative to left */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-terminal-border" />

              {r.change > 0 ? (
                <div
                  style={{ width: `${Math.min(100, (Math.abs(r.change) / maxBar) * 100)}%`, left: '50%' }}
                  className="absolute h-4 rounded-r bg-red-500"
                />
              ) : (
                <div
                  style={{ width: `${Math.min(100, (Math.abs(r.change) / maxBar) * 100)}%`, right: '50%' }}
                  className="absolute h-4 rounded-l bg-emerald-500"
                />
              )}
            </div>

            <div className="w-28 text-right text-slate-200 font-mono">
              {r.change >= 0 ? '+' : ''}{r.change.toFixed(2)} pp
            </div>
          </div>
        ))}

        {/* final cumulative */}
        <div className="flex items-center gap-3 pt-2 border-t border-terminal-border mt-2">
          <div className="w-44 text-slate-300 text-[13px]">Cumulative probability</div>
          <div className="flex-1 bg-terminal-bg/30 rounded h-4 relative">
            <div className="absolute left-0 right-0 top-0 bottom-0" />
            <div
              style={{ width: `${Math.min(100, Math.max(0, cumulative))}%` }}
              className={`h-4 rounded ${cumulative >= 50 ? 'bg-red-600' : 'bg-emerald-600'}`}
            />
          </div>
          <div className="w-28 text-right text-slate-200">{(Math.round(cumulative * 10) / 10).toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}
