import { useEffect, useState } from 'react';
import { fetchCurrentRisk } from '../api/client';
import type { CurrentRiskResponse } from '../api/client';

export function FalseAlarmAnalyzer({ explorerSectionRef }: { explorerSectionRef: React.RefObject<HTMLDivElement | null> }) {
  const [data, setData] = useState<CurrentRiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [legacyFlipped, setLegacyFlipped] = useState(true);
  const [mlFlipped, setMlFlipped] = useState(true);

  useEffect(() => {
    fetchCurrentRisk()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-16 text-center font-mono text-xs text-slate-500 animate-pulse">
        Loading macro telemetry...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 space-y-16">
      {/* Hero Section */}
      <section className="min-h-[85vh] flex flex-col justify-center mx-auto py-12 space-y-10">
        
        {/* Main Split Layout: Title on Left, Stacked Cards on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full">
          
          {/* Left Column: Title & Description */}
          <div className="lg:col-span-5 space-y-6 text-left">
            <h2 className="text-3xl md:text-5xl font-light text-zinc-100 tracking-tight leading-tight">
              Is it reliable to trust an inverted <span className="font-semibold text-white underline decoration-emerald-500/40 underline-offset-8">yield curve?</span>
            </h2>
            
            <p className="text-base md:text-lg text-zinc-400 font-light leading-relaxed">
              The traditional yield curve model (10Y–3M Treasury spread) catches recessions, yet it can occasionally trigger false alarms or stay inverted for too long during unique economic periods. This walk-forward ML architecture backtested on 50+ years of ingested FRED API data uses macroeconomic indicators to filter noise.
            </p>

            {/* Explore Button integrated nicely on the left */}
            <div className="pt-2">
              <button 
                type="button"
                onClick={() => {
                  explorerSectionRef.current?.scrollIntoView({ 
                    behavior: 'smooth',
                    block: 'start' 
                  });
                }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 transition-all duration-200 text-sm font-medium tracking-wide shadow-lg group cursor-pointer"
              >
                Take a Deep Dive into the Model
                <svg 
                  className="w-4 h-4 text-emerald-400 transform group-hover:translate-y-0.5 transition-transform" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Right Column: Stacked Cards */}
          <div className="lg:col-span-7 space-y-6 w-full [perspective:1000px]">
            
            {/* Card 1: Legacy Model */}
            <div 
              onClick={() => setLegacyFlipped(!legacyFlipped)} 
              className="cursor-pointer relative w-full h-[260px] transition-transform duration-500 [transform-style:preserve-3d]" 
              style={{ transform: legacyFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
              {/* Front of Card */}
              <div className="absolute inset-0 w-full h-full bg-[#0c0e14] border border-zinc-800 rounded-sm p-6 flex flex-col items-center justify-center text-center [backface-visibility:hidden] hover:border-zinc-700 transition-colors">
                <div className="flex flex-col gap-1.5 w-full">
                  <span className="text-sm font-medium text-zinc-400">Traditional Baseline</span>
                  <h3 className="text-2xl font-bold text-zinc-100 tracking-tight">Estrella-Mishkin (Yield-Curve) Model</h3>
                </div>
                <div className="absolute bottom-6 left-0 right-0 flex justify-center w-full">
                  <span className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                    View model metrics &rarr;
                  </span>
                </div>
              </div>

              {/* Back of Card */}
              <div className="absolute inset-0 w-full h-full bg-[#0c0e14] border border-zinc-800 rounded-sm p-6 flex flex-col justify-between text-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <span className="text-zinc-400 font-medium">Model</span>
                    <span className="text-zinc-100 font-semibold">Estrella-Mishkin (Traditional)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 font-medium">Assessment</span>
                    <span className="text-red-400 font-bold tracking-wide">ANY RECESSION RISK</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 font-medium">Recessions Caught</span>
                    <span className="text-zinc-100 font-semibold">100%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 font-medium">False Alarms Suppressed</span>
                    <span className="text-zinc-100 font-semibold">0%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 font-medium">Degree of Confidence In True Signals</span>
                    <span className="text-zinc-100 font-semibold">Low</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-400 font-medium">What it Does</span>
                  <span className="text-zinc-100 font-semibold">Reflects bond market pessimism without broader context</span>
                </div>
              </div>
            </div>

            {/* Card 2: ML Filter Model */}
            <div 
              onClick={() => setMlFlipped(!mlFlipped)} 
              className="cursor-pointer relative w-full h-[260px] transition-transform duration-500 [transform-style:preserve-3d]" 
              style={{ transform: mlFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
              {/* Front of Card */}
              <div className="absolute inset-0 w-full h-full bg-[#0c0e14] border border-zinc-800 rounded-sm p-6 flex flex-col items-center justify-center text-center [backface-visibility:hidden] hover:border-zinc-700 transition-colors">
                <div className="flex flex-col gap-1.5 w-full">
                  <span className="text-sm font-medium text-emerald-400">Second-Layer Filter</span>
                  <h3 className="text-2xl font-bold text-zinc-100 tracking-tight">Machine Learning Filtration Model</h3>
                </div>
                <div className="absolute bottom-6 left-0 right-0 flex justify-center w-full">
                  <span className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                    View model metrics &rarr;
                  </span>
                </div>
              </div>

              {/* Back of Card */}
              <div className="absolute inset-0 w-full h-full bg-[#0c0e14] border border-zinc-800 rounded-sm p-6 flex flex-col justify-between text-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
                    <span className="text-zinc-400 font-medium">Model</span>
                    <span className="text-zinc-100 font-semibold">ML Filtration Model</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 font-medium">Assessment</span>
                    <span className="text-emerald-400 font-bold tracking-wide">FILTERED RECESSION RISK</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 font-medium">Recessions Caught</span>
                    <span className="text-zinc-100 font-semibold">72%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 font-medium">False Alarms Suppressed</span>
                    <span className="text-zinc-100 font-semibold">93%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400 font-medium">Degree of Confidence In True Signals</span>
                    <span className="text-zinc-100 font-semibold">High</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-400 font-medium">What it Does</span>
                  <span className="text-zinc-100 font-semibold">Analyzes macro indicators to depict broader context</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </section>
    </div>
  );
}
