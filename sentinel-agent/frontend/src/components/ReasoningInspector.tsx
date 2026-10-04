import React from 'react';
import { SecurityAlert } from '../lib/api';
import {
  BrainCircuit,
  Eye,
  CheckCircle,
  HelpCircle,
  ShieldCheck,
  AlertOctagon,
  Sparkles,
  GitBranch,
} from 'lucide-react';

interface ReasoningInspectorProps {
  alert: SecurityAlert | null;
}

export const ReasoningInspector: React.FC<ReasoningInspectorProps> = ({ alert }) => {
  if (!alert) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-8 text-center text-slate-500 shadow-2xl backdrop-blur-sm h-full flex flex-col justify-center items-center">
        <BrainCircuit className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
        <h3 className="text-sm font-semibold text-slate-400">AI Reasoning Inspector Ready</h3>
        <p className="text-xs text-slate-600 mt-1 max-w-xs">
          Select any alert from the Alert Center to view SWI-Prolog deduction traces, observed facts, missing evidence, and alternative hypotheses.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm flex flex-col h-full">
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
            Symbolic Reasoning Inspector
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800">
            Rule: {alert.rule}
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
            Confidence: {alert.confidence}
          </span>
        </div>
      </div>

      <div className="p-4 overflow-y-auto max-h-[580px] space-y-4">
        {/* Safety Disclaimer */}
        <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-800/50 flex items-start gap-2 text-xs text-blue-300">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <strong>Educational Reasoning Trace:</strong> Inferences represent symbolic hypotheses derived from explicit Prolog logic, not guaranteed external compromise.
          </div>
        </div>

        {/* 1. Observed Facts (Raw Telemetry) */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            <Eye className="w-3.5 h-3.5 text-slate-400" />
            1. Observed Ground Facts (Raw Telemetry)
          </div>
          <ul className="space-y-1.5 font-mono text-xs">
            {alert.observed_facts?.map((fact, idx) => (
              <li
                key={idx}
                className="p-2 rounded bg-slate-950/80 border border-slate-800 text-slate-300 flex items-start gap-2"
              >
                <span className="text-cyan-400 font-bold">»</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 2. Inferred Deductions */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            2. Logical Inferences (Prolog Derived)
          </div>
          <ul className="space-y-1.5 font-sans text-xs">
            {alert.rationale?.map((rat, idx) => (
              <li
                key={idx}
                className="p-2 rounded bg-amber-950/20 border border-amber-900/40 text-amber-200 flex items-start gap-2"
              >
                <CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{rat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 3. Missing Corroborating Evidence */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            3. Missing Corroborating Evidence (Required to Prove Incident)
          </div>
          <ul className="space-y-1.5 text-xs">
            {alert.missing_evidence?.map((item, idx) => (
              <li
                key={idx}
                className="p-2 rounded bg-slate-950/60 border border-dashed border-slate-800 text-slate-400 flex items-start gap-2"
              >
                <span className="text-slate-600 font-mono">?</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 4. Alternative Benign Explanations */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            <GitBranch className="w-3.5 h-3.5 text-slate-400" />
            4. Plausible Benign Alternative Explanations
          </div>
          <ul className="space-y-1.5 text-xs">
            {alert.alternative_explanations?.map((alt, idx) => (
              <li
                key={idx}
                className="p-2 rounded bg-slate-950/60 border border-slate-800 text-slate-400 flex items-start gap-2"
              >
                <span className="text-emerald-500/80 font-mono">~</span>
                <span>{alt}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
