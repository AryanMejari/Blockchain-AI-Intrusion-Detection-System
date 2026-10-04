import React from 'react';
import { SecurityEvent } from '../lib/api';
import { Clock, ShieldAlert, KeyRound, Lock, FileCode, CheckCircle2 } from 'lucide-react';

interface AttackTimelineProps {
  timeline: SecurityEvent[];
}

export const AttackTimeline: React.FC<AttackTimelineProps> = ({ timeline }) => {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'failed_login':
        return <Lock className="w-3.5 h-3.5 text-red-400" />;
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
        return 'text-red-400 bg-red-950/80 border-red-800';
      case 'high':
        return 'text-orange-400 bg-orange-950/80 border-orange-800';
      case 'medium':
        return 'text-amber-400 bg-amber-950/80 border-amber-800';
      default:
        return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
        <Clock className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
          Correlated Attack Progression Timeline ({timeline.length} events)
        </h2>
      </div>

      {timeline.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-500">
          No sequential telemetry records present in current session.
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
          {timeline.map((ev, index) => (
            <div key={ev.id || index} className="relative group">
              {/* Dot */}
              <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center group-hover:border-cyan-400 transition-colors shadow">
                {getEventIcon(ev.type)}
              </div>

              {/* Card */}
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200 font-mono">
                      {ev.id}
                    </span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {ev.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border ${getSeverityPill(ev.severity)}`}>
                      {ev.severity}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      {ev.timestamp ? ev.timestamp.slice(11, 19) : ''}
                    </span>
                  </div>
                </div>

                <div className="text-slate-300 text-xs font-sans leading-relaxed">
                  <span className="font-mono text-cyan-400 mr-1.5 font-semibold">
                    [{ev.user || 'system'}]
                  </span>
                  {ev.detail || 'Telemetry event recorded'}
                </div>

                {ev.source && ev.source !== 'unknown' && (
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    Source: {ev.source}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
