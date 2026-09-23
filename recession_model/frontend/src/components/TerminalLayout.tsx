import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ShieldCheck } from 'lucide-react';

interface TerminalLayoutProps { children: React.ReactNode; }

export function TerminalLayout({ children }: TerminalLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isTrust = location.pathname === '/model-trust';

  const handleToggle = () => {
    if (isTrust) {
      navigate('/');
    } else {
      navigate('/model-trust');
    }
  };

  const [copied, setCopied] = React.useState(false);

  const handleCopyEmail = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const emailText = "Roshan.A.Shivnani.30@dartmouth.edu";

    // Modern Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(emailText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch (err) {
        console.error("Modern copy failed, trying fallback...", err);
      }
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col relative isolating-context">

      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="relative max-w-[1400px] mx-auto px-4 md:px-8 py-4 flex items-center justify-between min-h-[64px]">
          <div className="flex items-center gap-4 whitespace-nowrap">
            <span className="font-sans text-lg font-bold tracking-normal text-white select-none">
              YieldGuard
            </span>
            <span className="font-sans text-sm font-medium tracking-normal text-emerald-400/80 border-l border-emerald-900/80 pl-4 hidden sm:inline">
              Macroeconomic False Alarm Filter
            </span>
          </div>

          <div className="w-10 h-10 invisible sm:block pointer-events-none" />

          <div className="flex items-center gap-3 shrink-0 relative z-20 ml-auto">
            <button
              onClick={handleToggle}
              className="group flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-emerald-400 bg-[#0b1310] border border-emerald-900/80 rounded-lg shadow-sm hover:border-emerald-500/50 hover:text-emerald-300 transition-all cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {isTrust ? (
                <span>Return to Analyzer</span>
              ) : (
                <span className="text-zinc-300 group-hover:text-emerald-300 transition-colors">
                  Methodology Trust
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 md:px-8 py-6 md:py-10 relative z-10">
        {children}
      </main>

      <footer className="border-t border-slate-800 bg-slate-950/80 backdrop-blur-md py-6 text-slate-500 font-mono text-xs relative z-40 pointer-events-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center gap-3 text-center">

          <div className="flex flex-wrap items-center justify-center gap-2 text-slate-400">
            <span className="font-semibold text-slate-300">© 2026 YieldGuard Model:</span>
            <span>All rights reserved</span>
          </div>

          <p className="max-w-2xl text-[11px] text-slate-600 leading-relaxed">
            The model & website were both created solely for educational purposes as a personal project.
            The information provided does not constitute financial, investment, or legal advice.
          </p>

          <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-center gap-2 relative z-50">
            <span>Contact:</span>
            <button
              onClick={handleCopyEmail}
              type="button"
              className="text-slate-400 hover:text-emerald-400 underline transition-colors cursor-pointer bg-transparent border-none p-0 font-mono text-[11px] inline-block relative z-50 pointer-events-auto"
            >
              {copied ? (
                <span className="text-emerald-400 font-medium">Copied address to clipboard! ✓</span>
              ) : (
                <span>Roshan.A.Shivnani.30@dartmouth.edu</span>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}