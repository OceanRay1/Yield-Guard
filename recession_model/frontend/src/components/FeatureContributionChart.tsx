import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FeatureContributionChartProps {
  contributions?: any[];
  data?: any;
  selected?: any;
  topN?: number;
}

export function FeatureContributionChart({ contributions, data, selected, topN = 5 }: FeatureContributionChartProps) {
  let resolvedContributions: any[] = [];

  if (Array.isArray(contributions) && contributions.length) {
    resolvedContributions = contributions;
  } else if (Array.isArray(data?.pp_contributions) && data.pp_contributions.length) {
    resolvedContributions = data.pp_contributions;
  } else if (Array.isArray(data?.waterfall) && data.waterfall.length) {
    resolvedContributions = data.waterfall.map((it: any) => ({
      name: it.name ?? it.factor,
      prob_delta_pp: it.impact ?? it.value,
      direction: it.direction ?? ((it.impact ?? 0) >= 0 ? 'positive' : 'negative')
    }));
  } else if (Array.isArray(data?.positive_factors) || Array.isArray(data?.negative_factors)) {
    const pos = Array.isArray(data?.positive_factors) ? data.positive_factors : [];
    const neg = Array.isArray(data?.negative_factors) ? data.negative_factors : [];
    resolvedContributions = [...pos, ...neg].map((it: any) => ({
      name: it.name ?? it.factor ?? it.label,
      prob_delta_pp: it.impact ?? it.value,
      direction: it.direction ?? ((it.impact ?? 0) >= 0 ? 'positive' : 'negative')
    }));
  } else if (Array.isArray(data?.top_factors) && data.top_factors.length) {
    resolvedContributions = data.top_factors.map((it: any) => ({
      name: it.name ?? it.factor,
      prob_delta_pp: it.impact,
      direction: it.direction ?? ((it.impact ?? 0) >= 0 ? 'positive' : 'negative')
    }));
  } else if (Array.isArray(data) && data.length) {
    resolvedContributions = data as any[];
  }

  // Filter out incomplete/undefined entries so dummy placeholders never leak through
  const validContributions = resolvedContributions.filter(
    (f: any) => f && f.name && f.name !== 'unknown' && (f.prob_delta_pp !== undefined || f.impact !== undefined || f.value !== undefined)
  );

  // Trigger loading state if selected is missing OR if we don't have valid factors yet
  const isLoading = !selected || validContributions.length === 0;

  if (isLoading) {
    return (
      <section className="bg-[#0c0e14] border border-zinc-800 rounded-sm p-6 md:p-8 space-y-6">
        <div className="space-y-1.5 text-left">
          <span className="text-xs font-medium text-emerald-400 tracking-wide block">
            Attribution Analysis
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-zinc-100 tracking-tight">
            Event Specific Summary
          </h2>
        </div>

        {/* Loading Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {['Yield Curve Says', 'ML Verdict', 'ML Probability', 'Actual Outcome'].map((title, i) => (
            <div key={i} className="bg-zinc-950/80 border border-zinc-800 rounded-sm p-5 space-y-2">
              <p className="text-xs font-medium text-zinc-400 tracking-wide">{title}</p>
              <p className="text-sm font-semibold text-zinc-600 animate-pulse font-mono">Loading...</p>
            </div>
          ))}
        </div>

        {/* Loading Factor Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-sm p-5 space-y-3">
            <p className="text-xs font-medium text-zinc-300">Positive risk factors</p>
            <p className="text-xs text-zinc-600 animate-pulse font-mono">Loading factors...</p>
          </div>
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-sm p-5 space-y-3">
            <p className="text-xs font-medium text-zinc-300">Negative risk factors</p>
            <p className="text-xs text-zinc-600 animate-pulse font-mono">Loading factors...</p>
          </div>
        </div>

        {/* Loading Waterfall Area */}
        <div className="h-64 w-full bg-zinc-950/40 border border-dashed border-zinc-800 rounded-sm flex items-center justify-center">
          <p className="text-xs text-zinc-500 animate-pulse font-mono">
            Loading waterfall model data...
          </p>
        </div>
      </section>
    );
  }

  const sortedData = validContributions
    .slice()
    .sort((a: any, b: any) => Math.abs(b.prob_delta_pp ?? b.impact ?? 0) - Math.abs(a.prob_delta_pp ?? a.impact ?? 0))
    .slice(0, topN)
    .map((f: any) => {
      const rawVal = f.prob_delta_pp ?? f.impact ?? 0;
      const displayVal = Math.round((rawVal ?? 0) * 100) / 100;
      const name = f.name && typeof f.name === 'string' && f.name.length > 30 ? `${f.name.slice(0, 28)}...` : (f.name ?? 'Unknown');
      return {
        name,
        fullName: f.name,
        value: displayVal,
        direction: f.direction ?? (rawVal >= 0 ? 'positive' : 'negative'),
      };
    });

  const positiveFactors = validContributions
    .filter((f: any) => (f.prob_delta_pp ?? f.impact ?? 0) > 0)
    .sort((a: any, b: any) => Math.abs(b.prob_delta_pp ?? b.impact ?? 0) - Math.abs(a.prob_delta_pp ?? a.impact ?? 0))
    .slice(0, 4)
    .map((f: any) => {
      const rawVal = f.prob_delta_pp ?? f.impact ?? 0;
      const displayVal = Math.round((rawVal ?? 0) * 100) / 100;
      const name = f.name && typeof f.name === 'string' && f.name.length > 30 ? `${f.name.slice(0, 28)}...` : f.name;
      return {
        name,
        fullName: f.name,
        value: displayVal,
        direction: 'positive',
      };
    });

  const negativeFactors = validContributions
    .filter((f: any) => (f.prob_delta_pp ?? f.impact ?? 0) <= 0)
    .sort((a: any, b: any) => Math.abs(b.prob_delta_pp ?? b.impact ?? 0) - Math.abs(a.prob_delta_pp ?? a.impact ?? 0))
    .slice(0, 4)
    .map((f: any) => {
      const rawVal = f.prob_delta_pp ?? f.impact ?? 0;
      const displayVal = Math.round((rawVal ?? 0) * 100) / 100;
      const name = f.name && typeof f.name === 'string' && f.name.length > 30 ? `${f.name.slice(0, 28)}...` : f.name;
      return {
        name,
        fullName: f.name,
        value: displayVal,
        direction: 'negative',
      };
    });

  return (
    <section className="bg-[#0c0e14] border border-zinc-800 rounded-sm p-6 md:p-8 space-y-6">
      <div className="space-y-1.5 text-left">
        <span className="text-xs font-medium text-emerald-400 tracking-wide block">
          Attribution Analysis
        </span>
        <h2 className="text-xl md:text-2xl font-bold text-zinc-100 tracking-tight">
          Event Specific Summary
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-sm p-5 space-y-2">
          <p className="text-xs font-medium text-zinc-400 tracking-wide">Yield Curve Says</p>
          <p className="text-sm font-bold text-red-400 tracking-wide uppercase">
            {selected?.yield_curve_says ?? (selected?.yield_inversion ? 'RECESSION WARNING' : 'NO WARNING')}
          </p>
        </div>

        <div className="bg-zinc-950/80 border border-zinc-800 rounded-sm p-5 space-y-2">
          <p className="text-xs font-medium text-zinc-400 tracking-wide">ML Verdict</p>
          <p className="text-sm font-semibold text-blue-400">
            {selected?.ml_prediction ?? 'UNKNOWN'}
          </p>
        </div>

        <div className="bg-zinc-950/80 border border-zinc-800 rounded-sm p-5 space-y-2">
          <p className="text-xs font-medium text-zinc-400 tracking-wide">ML Probability</p>
          <p className="text-xl font-bold text-amber-400 tracking-tight">
            {selected?.ml_probability != null ? `${selected.ml_probability}%` : 'N/A'}
          </p>
        </div>

        <div className="bg-zinc-950/80 border border-zinc-800 rounded-sm p-5 space-y-2">
          <p className="text-xs font-medium text-zinc-400 tracking-wide">Actual Outcome</p>
          <p className={`text-xl font-bold tracking-tight ${selected?.outcome?.toUpperCase().includes('NO') ? 'text-emerald-400' : 'text-red-400'}`}>
            {selected?.outcome ?? 'N/A'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-sm p-5 space-y-3">
          <p className="text-xs font-medium text-zinc-300">Positive risk factors</p>
          <div className="space-y-2 text-xs">
            {positiveFactors.length > 0 ? (
              positiveFactors.map((item, idx) => (
                <div key={`pos-${idx}`} className="flex justify-between items-center text-zinc-400">
                  <span className="truncate pr-2 font-light" title={item.fullName}>{item.name}</span>
                  <span className="text-red-400 font-semibold whitespace-nowrap">+{item.value} pp</span>
                </div>
              ))
            ) : (
              <p className="text-zinc-600 italic">None active</p>
            )}
          </div>
        </div>

        <div className="bg-zinc-950/80 border border-zinc-800 rounded-sm p-5 space-y-3">
          <p className="text-xs font-medium text-zinc-300">Negative risk factors</p>
          <div className="space-y-2 text-xs">
            {negativeFactors.length > 0 ? (
              negativeFactors.map((item, idx) => (
                <div key={`neg-${idx}`} className="flex justify-between items-center text-zinc-400">
                  <span className="truncate pr-2 font-light" title={item.fullName}>{item.name}</span>
                  <span className="text-emerald-400 font-semibold whitespace-nowrap">{item.value} pp</span>
                </div>
              ))
            ) : (
              <p className="text-zinc-600 italic">None active</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-zinc-800">
        <div>
          <h3 className="text-lg font-bold text-zinc-100 tracking-tight">
            Risk Contribution Waterfall
          </h3>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="text-zinc-400 font-light">False Alarm Shield (Green)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
            <span className="text-zinc-400 font-light">Risk Amplifying (Red)</span>
          </div>
        </div>
      </div>

      <div className="h-72 w-full bg-zinc-950/40 border border-zinc-800/60 rounded-sm p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sortedData.map(item => ({
              ...item,
              displayValue: Math.abs(item.value)
            }))}
            margin={{ top: 25, right: 10, left: 10, bottom: 30 }}
          >
            <XAxis 
              dataKey="name" 
              stroke="#71717a" 
              tick={{ fill: '#a1a1aa', fontSize: 11 }} 
              axisLine={{ stroke: '#27272a' }} 
              tickLine={false}
              interval={0}
            />
            <YAxis 
              type="number" 
              stroke="#71717a" 
              tick={{ fill: '#a1a1aa', fontSize: 11 }} 
              axisLine={{ stroke: '#27272a' }} 
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }}
              formatter={(value: any, name: any, item: any) => {
                const val = item?.payload?.value ?? 0;
                return [
                  `${val > 0 ? '+' : ''}${val} pp`, 
                  val > 0 ? 'Risk Amplifying' : 'False Alarm Shield'
                ];
              }}
              contentStyle={{ 
                backgroundColor: '#0c0e14', 
                borderColor: '#27272a', 
                borderRadius: '2px',
                color: '#f4f4f5',
                fontSize: '12px'
              }}
            />
            <Bar dataKey="displayValue" barSize={100} radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {sortedData.map((entry, idx) => (
                <Cell
                  key={`${entry.name}-${idx}`}
                  fill={entry.value >= 0 ? '#f87171' : '#34d399'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default FeatureContributionChart;