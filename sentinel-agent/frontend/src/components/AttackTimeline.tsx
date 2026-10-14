import React from 'react';
import { SecurityEvent } from '../lib/api';
import { Clock, ShieldAlert, KeyRound, Lock, FileCode, CheckCircle2, History } from 'lucide-react';

interface AttackTimelineProps {
  timeline: SecurityEvent[];
  activeAlertId?: string;
}

export const AttackTimeline: React.FC<AttackTimelineProps> = ({ timeline }) => {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'failed_login':
        return <Lock className="w-3.5 h-3.5 text-rose-400" />;
      case 'successful_login':
        return <KeyRound className="w-3.5 h-3.5 text-emerald-400" />;
      case 'account_lockout':
        return <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />;
      case 'sensitive_access':
      case 'privilege_change':
        return <FileCode className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  const getSeverityPill = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'text-rose-400 bg-rose-950/80 border-rose-800';
      case 'high':
        return 'text-orange-400 bg-orange-950/80 border-orange-800';
      case 'medium':
        return 'text-amber-400 bg-amber-950/80 border-amber-800';
      default:
        return 'text-slate-400 bg-slate-800/80 border-slate-700';
    }
  };

  return (
    <div className="neo-card rounded-2xl p-6 shadow-2xl h-full flex flex-col">
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.04] mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold tracking-wider uppercase text-slate-200">
            Correlated Attack Progression Timeline ({timeline.length} events)
          </h2>
        </div>
        <span className="text-[10px] text-slate-400 font-mono neo-well px-2.5 py-0.5 rounded-full">
          Chronological Pipeline
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {timeline.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 neo-well rounded-xl">
            <History className="w-10 h-10 text-slate-600 mb-2" />
            <p className="text-slate-300 text-sm font-semibold">No Timeline Telemetry</p>
            <p className="text-slate-500 text-xs mt-1 max-w-sm">
              Sequence of attack events will populate chronologically when simulations or auth events are processed.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/[0.06]">
            {timeline.map((ev, index) => (
              <div key={ev.id || index} className="relative group">
                {/* Dot */}
                <div className="absolute -left-6 top-2 w-5 h-5 rounded-full neo-card flex items-center justify-center group-hover:border-cyan-400 transition-colors shadow">
                  {getEventIcon(ev.type)}
                </div>

                {/* Card */}
                <div className="p-3.5 rounded-xl neo-card-raised text-xs transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-cyan-400 font-mono text-[11px]">
                        {ev.id}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full neo-well text-slate-300 font-mono">
                        {ev.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border neo-pill ${getSeverityPill(ev.severity)}`}>
                        {ev.severity}
                      </span>
                      <span className="text-slate-500 font-mono text-[10px]">
                        {ev.timestamp ? ev.timestamp.slice(11, 19) : ''}
                      </span>
                    </div>
                  </div>

                  <div className="text-slate-300 text-xs font-sans leading-relaxed">
                    <span className="font-mono text-slate-200 mr-1.5 font-bold">
                      [{ev.user || 'system'}]
                    </span>
                    {ev.detail || 'Telemetry event recorded'}
                  </div>

                  {ev.source && ev.source !== 'unknown' && (
                    <div className="text-[10px] text-slate-500 font-mono mt-1.5 flex items-center gap-2">
                      <span>Source Node: {ev.source}</span>
                      {ev.count && ev.count > 1 && (
                        <span>• Iteration Count: {ev.count}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
