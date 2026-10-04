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
          border: 'border-red-500/60 hover:border-red-400',
          badge: 'bg-red-950 text-red-400 border border-red-800',
          icon: <Flame className="w-4 h-4 text-red-400" />,
          glow: 'shadow-[0_0_15px_-3px_rgba(239,68,68,0.25)]',
        };
      case 'high':
        return {
          border: 'border-orange-500/50 hover:border-orange-400',
          badge: 'bg-orange-950 text-orange-400 border border-orange-800',
          icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
          glow: 'shadow-[0_0_15px_-3px_rgba(249,115,22,0.2)]',
        };
      case 'medium':
        return {
          border: 'border-amber-500/40 hover:border-amber-400',
          badge: 'bg-amber-950 text-amber-400 border border-amber-800',
          icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
          glow: '',
        };
      default:
        return {
          border: 'border-slate-700 hover:border-slate-600',
          badge: 'bg-slate-800 text-slate-300 border border-slate-700',
          icon: <Shield className="w-4 h-4 text-slate-400" />,
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
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm flex flex-col h-full">
      <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
            Prolog Active Alerts ({alerts.length})
          </h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Symbolic Inferences
        </span>
      </div>

      <div className="p-4 overflow-y-auto max-h-[580px] space-y-3.5">
        {alerts.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl bg-slate-950/30">
            <Shield className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-300 text-sm font-medium">No Active Security Alerts</p>
            <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
              Simulate an attack from the Login Screen or wait for telemetry thresholds to trigger Prolog rules.
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
                className={`p-4 rounded-xl border transition-all cursor-pointer bg-slate-950/60 relative ${style.border} ${style.glow} ${
                  isSelected ? 'ring-2 ring-cyan-400 bg-slate-900/90' : ''
                }`}
              >
                {/* Header line */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    {style.icon}
                    <h3 className="text-sm font-semibold text-slate-100 tracking-wide">
                      {alert.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${style.badge}`}>
                      {alert.severity}
                    </span>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                      Score: {alert.risk_score}
                    </span>
                  </div>
                </div>

                {/* Subject & Summary */}
                <div className="text-xs text-slate-300 mb-2.5 font-sans leading-relaxed">
                  <span className="font-semibold text-slate-100 mr-1.5 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
                    Target: {alert.subject}
                  </span>
                  {alert.summary}
                </div>

                {/* Supporting Evidence IDs */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px] font-mono text-slate-400">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Evidence ({alert.evidence_count}):
                  </span>
                  {alert.evidence_ids?.map((eid) => (
                    <span
                      key={eid}
                      className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-cyan-400"
                    >
                      {eid}
                    </span>
                  ))}
                </div>

                {/* Recommended Investigation Action */}
                {alert.recommended_action && (
                  <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 mb-3 flex items-start gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <div className="font-semibold text-cyan-300">
                        {alert.recommended_action.title}
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        {alert.recommended_action.reason}
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Controls: Status Changer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {alert.created_at ? alert.created_at.slice(11, 19) : ''}
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[11px] text-slate-400">Status:</span>
                    <select
                      value={alert.status}
                      onChange={(e) =>
                        onStatusChange(
                          alert.id,
                          e.target.value as 'new' | 'investigating' | 'resolved' | 'false_positive'
                        )
                      }
                      className={`text-xs px-2 py-1 rounded border font-semibold focus:outline-none ${getStatusColor(
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
