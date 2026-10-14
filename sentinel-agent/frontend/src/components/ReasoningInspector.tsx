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
  Cpu,
} from 'lucide-react';

interface ReasoningInspectorProps {
  alert: SecurityAlert | null;
}

export const ReasoningInspector: React.FC<ReasoningInspectorProps> = ({ alert }) => {
  if (!alert) {
    return (
      <div className="neo-card rounded-2xl p-8 text-center text-slate-500 shadow-2xl h-full flex flex-col justify-center items-center">
        <div className="w-16 h-16 rounded-2xl neo-well flex items-center justify-center mb-4">
          <BrainCircuit className="w-8 h-8 text-cyan-400/70 animate-pulse" />
        </div>
        <h3 className="text-sm font-bold text-slate-300">SWI-Prolog AI Reasoning Inspector</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
          Select an incident from the Alert Center to view symbolic deduction traces, observed ground facts, missing evidence, and plausible alternative hypotheses.
        </p>
      </div>
    );
  }

  return (
    <div className="neo-card rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.04] bg-[#0d121f]/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold tracking-wider uppercase text-slate-200">
            Symbolic Reasoning Inspector
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full neo-well text-cyan-400">
            Rule: {alert.rule}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full neo-pill bg-slate-800 text-slate-300 border border-slate-700">
            Confidence: {alert.confidence?.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="p-5 overflow-y-auto flex-1 space-y-4 scrollbar-thin">
        {/* Safety Disclaimer */}
        <div className="p-3 rounded-xl neo-well flex items-start gap-2.5 text-xs text-cyan-300">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed text-[11px]">
            <strong>Formal Prolog Derivation:</strong> Inferences represent symbolic hypotheses proved from ground facts using Horn clause logic.
          </div>
        </div>

        {/* 1. Observed Ground Facts */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            <Eye className="w-3.5 h-3.5 text-slate-400" />
            <span>1. Observed Ground Facts (Raw Telemetry)</span>
          </div>
          <ul className="space-y-1.5 font-mono text-xs">
            {alert.observed_facts?.length > 0 ? (
              alert.observed_facts.map((fact, idx) => (
                <li
                  key={idx}
                  className="p-2.5 rounded-xl neo-well text-slate-300 flex items-start gap-2"
                >
                  <span className="text-cyan-400 font-bold">»</span>
                  <span className="text-[11px] leading-relaxed">{fact}</span>
                </li>
              ))
            ) : (
              <li className="p-2.5 rounded-xl neo-well text-slate-500 text-xs">
                Raw event telemetry correlated by rule parameters.
              </li>
            )}
          </ul>
        </div>

        {/* 2. Inferred Deductions */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>2. Logical Inferences (Prolog Derived)</span>
          </div>
          <ul className="space-y-1.5 text-xs">
            {alert.rationale?.map((rat, idx) => (
              <li
                key={idx}
                className="p-2.5 rounded-xl neo-well border-l-2 border-l-amber-400 text-amber-200 flex items-start gap-2"
              >
                <CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">{rat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 3. Missing Corroborating Evidence */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>3. Missing Corroborating Evidence</span>
          </div>
          <ul className="space-y-1.5 text-xs">
            {alert.missing_evidence?.map((item, idx) => (
              <li
                key={idx}
                className="p-2.5 rounded-xl neo-well text-slate-400 flex items-start gap-2 border border-dashed border-white/[0.04]"
              >
                <span className="text-slate-600 font-mono font-bold">?</span>
                <span className="text-[11px] leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 4. Alternative Benign Explanations */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            <GitBranch className="w-3.5 h-3.5 text-slate-400" />
            <span>4. Plausible Benign Alternative Explanations</span>
          </div>
          <ul className="space-y-1.5 text-xs">
            {alert.alternative_explanations?.map((alt, idx) => (
              <li
                key={idx}
                className="p-2.5 rounded-xl neo-well text-slate-400 flex items-start gap-2"
              >
                <span className="text-emerald-500 font-mono font-bold">~</span>
                <span className="text-[11px] leading-relaxed">{alt}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
