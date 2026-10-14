import React from 'react';
import { SecurityAlert } from '../lib/api';
import {
  AlertTriangle,
  Flame,
  Shield,
  HelpCircle,
  Clock,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Layers,
  Cpu,
} from 'lucide-react';

interface AlertCenterProps {
  alerts: SecurityAlert[];
  selectedAlertId: string | null;
  onSelectAlert: (alert: SecurityAlert) => void;
  onStatusChange: (alertId: string, status: 'new' | 'investigating' | 'resolved' | 'false_positive') => void;
}

export const AlertCenter: React.FC<AlertCenterProps> = ({
  alerts,
  selectedAlertId,
  onSelectAlert,
  onStatusChange,
}) => {
  const getSeverityStyle = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return {
          border: 'border-l-4 border-l-rose-500 border-white/[0.04]',
          badge: 'bg-rose-950/80 text-rose-400 border-rose-800',
          icon: <Flame className="w-4 h-4 text-rose-400" />,
          glow: 'shadow-[0_0_20px_rgba(244,63,94,0.18)]',
        };
      case 'high':
        return {
          border: 'border-l-4 border-l-orange-500 border-white/[0.04]',
          badge: 'bg-orange-950/80 text-orange-400 border-orange-800',
          icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
          glow: 'shadow-[0_0_18px_rgba(249,115,22,0.15)]',
        };
      case 'medium':
        return {
          border: 'border-l-4 border-l-amber-500 border-white/[0.04]',
          badge: 'bg-amber-950/80 text-amber-400 border-amber-800',
          icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
          glow: '',
        };
      default:
        return {
          border: 'border-l-4 border-l-cyan-500 border-white/[0.04]',
          badge: 'bg-slate-800 text-slate-300 border-slate-700',
          icon: <Shield className="w-4 h-4 text-cyan-400" />,
          glow: '',
        };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'investigating':
        return 'text-blue-400 border-blue-800 bg-blue-950/60';
      case 'resolved':
        return 'text-emerald-400 border-emerald-800 bg-emerald-950/60';
      case 'false_positive':
        return 'text-slate-400 border-slate-700 bg-slate-900';
      default:
        return 'text-amber-400 border-amber-800 bg-amber-950/60';
    }
  };

  return (
    <div className="neo-card rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.04] bg-[#0d121f]/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold tracking-wider uppercase text-slate-200">
            Prolog Active Alerts ({alerts.length})
          </h2>
        </div>
        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
          <Cpu className="w-3 h-3 text-cyan-400" /> Symbolic Inferences
        </span>
      </div>

      {/* Alert List */}
      <div className="p-4 overflow-y-auto flex-1 space-y-3.5 scrollbar-thin">
        {alerts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 neo-well rounded-xl">
            <div className="w-12 h-12 rounded-2xl neo-card flex items-center justify-center mb-3">
              <Shield className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-slate-200 text-sm font-semibold">Clean State: No Active Threats</p>
            <p className="text-slate-400 text-xs mt-1 max-w-xs leading-relaxed">
              All endpoints secure. Execute an attack simulation from the Login Screen to test Prolog real-time detection.
            </p>
          </div>
        ) : (
          alerts.map((alert) => {
            const style = getSeverityStyle(alert.severity);
            const isSelected = selectedAlertId === alert.id;

            return (
              <div
                key={alert.id}
                onClick={() => onSelectAlert(alert)}
                className={`p-4 rounded-xl transition-all cursor-pointer neo-card-raised relative ${style.border} ${style.glow} ${
                  isSelected ? 'ring-2 ring-cyan-400 shadow-xl' : 'hover:border-cyan-500/30'
                }`}
              >
                {/* Header line */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    {style.icon}
                    <h3 className="text-xs font-bold text-slate-100 tracking-wide">
                      {alert.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border neo-pill ${style.badge}`}>
                      {alert.severity}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full neo-well text-cyan-300">
                      Score: {alert.risk_score}
                    </span>
                  </div>
                </div>

                {/* Subject & Summary */}
                <div className="text-xs text-slate-300 mb-2.5 font-sans leading-relaxed">
                  <span className="font-semibold text-slate-100 mr-1.5 font-mono neo-well px-2 py-0.5 rounded-md text-[11px]">
                    Target: {alert.subject}
                  </span>
                  {alert.summary}
                </div>

                {/* Supporting Evidence IDs */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[10px] font-mono text-slate-400">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Evidence ({alert.evidence_count}):
                  </span>
                  {alert.evidence_ids?.map((eid) => (
                    <span
                      key={eid}
                      className="px-1.5 py-0.5 neo-well rounded text-cyan-400"
                    >
                      {eid}
                    </span>
                  ))}
                </div>

                {/* Recommended Investigation Action */}
                {alert.recommended_action && (
                  <div className="p-2.5 rounded-xl neo-well mb-3 flex items-start gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <div className="font-semibold text-cyan-300 text-[11px]">
                        {alert.recommended_action.title}
                      </div>
                      <div className="text-slate-400 text-[10px] mt-0.5 leading-relaxed">
                        {alert.recommended_action.reason}
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Controls: Status Changer */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] text-xs">
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {alert.created_at ? alert.created_at.slice(11, 19) : ''}
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] text-slate-400">Triage:</span>
                    <select
                      value={alert.status}
                      onChange={(e) =>
                        onStatusChange(
                          alert.id,
                          e.target.value as 'new' | 'investigating' | 'resolved' | 'false_positive'
                        )
                      }
                      className={`text-[10px] rounded-lg px-2 py-1 font-semibold neo-btn focus:outline-none ${getStatusColor(
                        alert.status
                      )}`}
                    >
                      <option value="new">New</option>
                      <option value="investigating">Investigating</option>
                      <option value="resolved">Resolved</option>
                      <option value="false_positive">False Positive</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
