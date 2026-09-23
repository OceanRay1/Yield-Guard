import { useState, useEffect, useRef } from 'react';
import { FalseAlarmExplorer } from '../components/FalseAlarmExplorer';
import { FalseAlarmAnalyzer } from '../components/FalseAlarmAnalyzer';
import { FeatureContributionChart } from '../components/FeatureContributionChart';
import { ScenarioSimulator } from '../components/ScenarioSimulator';
import { ProbabilityChart } from '../components/ProbabilityChart';
import { fetchExplainability, fetchEventExplanation } from '../api/client';
import type { ExplainabilityResponse } from '../api/client';

export function AnalyzerPage() {
  const [explainabilityData, setExplainabilityData] = useState<ExplainabilityResponse | null>(null);
  const [shapLoading, setShapLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventExplainability, setSelectedEventExplainability] = useState<any | null>(null);

  // 1. Create the ref for the explorer section
  const explorerSectionRef = useRef<HTMLDivElement>(null);

  const handleRefreshShap = () => {
    setShapLoading(true);
    fetchExplainability()
      .then(setExplainabilityData)
      .finally(() => setShapLoading(false));
  };

  useEffect(() => {
    handleRefreshShap();
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      setSelectedEventExplainability(null);
      return;
    }
    let mounted = true;
    setShapLoading(true);
    fetchEventExplanation(selectedEventId)
      .then((d) => {
        if (mounted) setSelectedEventExplainability(d);
      })
      .catch(() => {
        if (mounted) setSelectedEventExplainability(null);
      })
      .finally(() => {
        if (mounted) setShapLoading(false);
      });
    return () => { mounted = false; };
  }, [selectedEventId]);

  if (!explainabilityData) {
    return (
      <div className="p-6 font-mono text-xs text-slate-400">
        Loading analyzer data...
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      {/* 2. Pass the ref down to FalseAlarmAnalyzer */}
      <FalseAlarmAnalyzer explorerSectionRef={explorerSectionRef} />
      <div ref={explorerSectionRef} className="scroll-mt-24">
        <FalseAlarmExplorer
          onRefresh={handleRefreshShap}
          shapLoading={shapLoading}
          selectedId={selectedEventId}
          onSelect={setSelectedEventId}
          onSelectedEvent={setSelectedEvent}
        />
      </div>

      <FeatureContributionChart
        data={selectedEventExplainability ?? explainabilityData}
        selected={selectedEvent}
      />
      <ProbabilityChart />
      <ScenarioSimulator />
    </div>
  );
}

export default AnalyzerPage;