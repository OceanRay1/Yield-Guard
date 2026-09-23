import { useEffect, useState, useRef } from 'react';
import { fetchHistoricalEvents } from '../api/client';
import type { HistoricalEvent } from '../api/client';
import { HistoricalEventTimeline } from './HistoricalEventTimeline';

interface FalseAlarmExplorerProps {
  onRefresh?: () => void;
  shapLoading?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onSelectedEvent?: (event: any) => void;
}

export function FalseAlarmExplorer({ selectedId: controlledSelectedId, onSelect, onSelectedEvent }: FalseAlarmExplorerProps) {
  const [events, setEvents] = useState<HistoricalEvent[]>([]);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Global execution lock ref to prevent rapid-click race conditions on heavy analytics pipelines
  const isExecutingRef = useRef(false);
  
  useEffect(() => {
    fetchHistoricalEvents()
      .then((data) => {
        setEvents(data);
        const initialId = data.find((e: any) => e.year === 2007)?.id ?? data[0]?.id ?? null;
        if (onSelect) {
          onSelect(initialId);
        } else {
          setInternalSelectedId(initialId);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;
  const selected: any = events.find((e: any) => e.id === selectedId);

  useEffect(() => {
    if (selected) {
      onSelectedEvent?.(selected);
    }
  }, [selected]);

  // Safe wrapper for handling timeline event selections with race-condition prevention
  const handleEventSelect = async (id: string | null) => {
    if (isExecutingRef.current) {
      console.warn("Analysis pipeline already running. Ignoring rapid click.");
      return;
    }

    isExecutingRef.current = true;

    try {
      if (onSelect) {
        onSelect(id);
      } else {
        setInternalSelectedId(id);
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    } finally {
      isExecutingRef.current = false;
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center font-mono text-xs text-slate-500 animate-pulse">
        Loading historical inversion events...
      </div>
    );
  }

  return (
    <section className="bg-[#0c0e14] border border-zinc-800 rounded-sm p-6 md:p-8 space-y-6">
      {/* Top Header Row with Title on Left and Larger Selected Event Box on Right */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1.5 text-left">
          <span className="text-xs font-medium text-emerald-400 tracking-wide block">
            False Alarm Explorer
          </span>
          <h2 className="text-xl md:text-2xl font-bold text-zinc-100 tracking-tight">
            Historical Yield Inversions, 1970–Present
          </h2>
          <p className="text-xs md:text-sm text-zinc-400 font-light leading-relaxed max-w-xl">
            Click any event and scroll down to inspect why the ML filter agreed or disagreed with the yield curve.
          </p>
        </div>

        {/* Larger Selected Event Box on the Right */}
        {selected && (
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-sm p-5 shadow-lg lg:min-w-[340px] flex flex-col justify-center">
            <span className="text-xs font-medium text-emerald-400 mb-1 block">
              Selected Event ({selected.date || selected.year})
            </span>
            <h3 className="text-lg font-bold text-zinc-100 tracking-tight">
              {selected.label}
            </h3>
          </div>
        )}
      </div>

      {/* Timeline Component with execution guard wrapper */}
      <HistoricalEventTimeline
        events={events}
        selectedId={selectedId}
        onSelect={(id) => handleEventSelect(id)}
      />
    </section>
  );
}