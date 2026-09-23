import type { HistoricalEvent } from '../api/client';

interface HistoricalEventTimelineProps {
  events: HistoricalEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function outcomeColor(outcome: string) {
  if (outcome === 'RECESSION') return 'bg-red-500 shadow-red-500/50';
  return 'bg-emerald-500 shadow-emerald-500/50';
}

export function HistoricalEventTimeline({ events, selectedId, onSelect }: HistoricalEventTimelineProps) {
  const minYear = 1970;
  const maxYear = 2025;

  return (
    <div className="relative pt-12 pb-8 px-12 select-none">
      <div className="relative w-full h-[2px] bg-slate-700/80 my-8">
        
        {/* 1970 Start Label */}
        <span className="absolute -left-10 -top-2.5 font-mono text-xs text-slate-500">
          {minYear}
        </span>

        {/* 2025 End Label */}
        <span className="absolute -right-10 -top-2.5 font-mono text-xs text-slate-500">
          {maxYear}
        </span>

        {/* Timeline Nodes */}
        {events.map((event, index) => {
          let yearNum = event.year ?? 1970;
          let month = 1;
          if (event.date) {
            const parts = event.date.split('-');
            yearNum = parseInt(parts[0], 10) || yearNum;
            month = parts.length >= 2 ? parseInt(parts[1], 10) || 1 : 1;
          }
          
          const rawPct = (((yearNum + (month - 1) / 12) - minYear) / (maxYear - minYear)) * 100;
          const leftPct = Math.max(0, Math.min(100, rawPct));
          
          const selected = selectedId === event.id;
          const isTop = index % 2 === 0;

          const shortDateLabel = event.date ? event.date.slice(0, 7) : String(event.year);

          return (
            <button
              key={event.id}
              type="button"
              onClick={() => onSelect(event.id)}
              className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none cursor-pointer"
              style={{ left: `${leftPct}%`, top: '0px' }}
              title={event.label}
              aria-label={`Historical event ${event.label}`}
            >
              <div
                className={`w-4 h-4 rounded-full ${outcomeColor(event.outcome)} shadow-md transition-all duration-200 z-10 flex items-center justify-center ${
                  selected ? 'scale-150 ring-4 ring-white/20 bg-white' : 'group-hover:scale-125'
                }`}
              />

              <span
                className={`absolute left-1/2 -translate-x-1/2 font-mono text-[10px] whitespace-nowrap tracking-wider transition-all duration-200 ${
                  selected 
                    ? 'text-white font-bold scale-110 z-20 bg-terminal-panel px-1.5 py-0.5 rounded border border-white/30' 
                    : 'text-slate-400 group-hover:text-slate-200'
                }`}
                style={{
                  top: isTop ? 'auto' : '16px',
                  bottom: isTop ? '16px' : 'auto',
                }}
              >
                {shortDateLabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}