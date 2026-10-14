import React, { useState, useEffect } from 'react';
import { SecurityAlert } from '../lib/api';
import {
  ShieldAlert,
  Flame,
  AlertTriangle,
  Info,
  X,
  ExternalLink,
  Volume2,
  VolumeX,
  Cpu,
  ArrowRight,
} from 'lucide-react';

export interface ToastItem {
  id: string;
  alert: SecurityAlert;
  createdAt: number;
  durationMs: number;
}

interface AdminToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onNavigateToDashboard?: () => void;
  onSelectAlert?: (alert: SecurityAlert) => void;
}

// Synthesized gentle cyber alert chime via Web Audio API
export function playAlertChime(severity: string = 'high') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    const isCritical = severity.toLowerCase() === 'critical';
    const isHigh = severity.toLowerCase() === 'high';

    // Frequency sequence
    osc1.frequency.setValueAtTime(isCritical ? 880 : isHigh ? 659.25 : 523.25, now);
    osc1.frequency.exponentialRampToValueAtTime(isCritical ? 1046.5 : isHigh ? 830.6 : 659.25, now + 0.12);

    osc2.frequency.setValueAtTime(isCritical ? 440 : 329.63, now);
    osc2.frequency.exponentialRampToValueAtTime(isCritical ? 523.25 : 415.3, now + 0.12);

    gainNode.gain.setValueAtTime(0.08, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.36);
    osc2.stop(now + 0.36);
  } catch (e) {
    // Audio context may be restricted by browser policy until interaction
  }
}

export const AdminToastContainer: React.FC<AdminToastContainerProps> = ({
  toasts,
  onDismiss,
  onNavigateToDashboard,
  onSelectAlert,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-3.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.id)}
          onNavigateToDashboard={onNavigateToDashboard}
          onSelectAlert={onSelectAlert}
        />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{
  toast: ToastItem;
  onDismiss: () => void;
  onNavigateToDashboard?: () => void;
  onSelectAlert?: (alert: SecurityAlert) => void;
}> = ({ toast, onDismiss, onNavigateToDashboard, onSelectAlert }) => {
  const { alert } = toast;
  const [progress, setProgress] = useState(100);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;
    const interval = 50;
    const step = (interval / toast.durationMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isHovered, toast.durationMs, onDismiss]);

  const getSeverityData = (sev: string) => {
    switch (sev?.toLowerCase()) {
      case 'critical':
        return {
          label: 'CRITICAL THREAT',
          badgeBg: 'bg-rose-950/80 text-rose-400 border-rose-800',
          accentBorder: 'border-l-4 border-l-rose-500',
          glow: 'shadow-[0_0_25px_rgba(244,63,94,0.3)]',
          icon: <Flame className="w-5 h-5 text-rose-400 animate-pulse" />,
          progressBg: 'bg-rose-500',
        };
      case 'high':
        return {
          label: 'HIGH RISK ALERT',
          badgeBg: 'bg-orange-950/80 text-orange-400 border-orange-800',
          accentBorder: 'border-l-4 border-l-orange-500',
          glow: 'shadow-[0_0_25px_rgba(249,115,22,0.25)]',
          icon: <ShieldAlert className="w-5 h-5 text-orange-400" />,
          progressBg: 'bg-orange-500',
        };
      case 'medium':
        return {
          label: 'MEDIUM SUSPICION',
          badgeBg: 'bg-amber-950/80 text-amber-400 border-amber-800',
          accentBorder: 'border-l-4 border-l-amber-500',
          glow: 'shadow-[0_0_20px_rgba(245,158,11,0.2)]',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          progressBg: 'bg-amber-500',
        };
      default:
        return {
          label: 'INFORMATIONAL',
          badgeBg: 'bg-cyan-950/80 text-cyan-400 border-cyan-800',
          accentBorder: 'border-l-4 border-l-cyan-500',
          glow: '',
          icon: <Info className="w-5 h-5 text-cyan-400" />,
          progressBg: 'bg-cyan-500',
        };
    }
  };

  const style = getSeverityData(alert.severity);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`pointer-events-auto neo-card-raised ${style.accentBorder} rounded-2xl overflow-hidden p-4 transition-all duration-300 transform translate-y-0 opacity-100 ${style.glow}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {style.icon}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border neo-pill ${style.badgeBg}`}>
                {style.label}
              </span>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/60 flex items-center gap-1">
                <Cpu className="w-2.5 h-2.5" /> AI Prolog Reasoner
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800/50 transition-colors"
          title="Dismiss toast"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Title & Summary */}
      <div className="mb-2.5">
        <h4 className="text-xs font-bold text-slate-100 leading-snug">
          {alert.title || 'Security Anomaly Detected'}
        </h4>
        <p className="text-[11px] text-slate-300 mt-1 line-clamp-2 leading-relaxed">
          {alert.summary || 'SWI-Prolog reasoning engine correlated adversarial telemetry meeting risk threshold.'}
        </p>
      </div>

      {/* Target & Source Pill Meta */}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mb-3 p-2 rounded-xl neo-well text-slate-300">
        <div>
          <span className="text-slate-500 text-[10px] block">TARGET USER</span>
          <span className="font-semibold text-slate-200 truncate block">
            {alert.subject || 'Unknown'}
          </span>
        </div>
        <div>
          <span className="text-slate-500 text-[10px] block">RULE TRIGGERED</span>
          <span className="text-cyan-400 truncate block font-bold" title={alert.rule}>
            {alert.rule}
          </span>
        </div>
      </div>

      {/* Quick Action Footer */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-[10px] text-slate-400 font-mono">
          Confidence: <span className="text-emerald-400 font-bold">{alert.confidence?.toUpperCase()}</span>
          {alert.risk_score ? ` • Risk: ${alert.risk_score}/100` : ''}
        </div>

        <div className="flex items-center gap-2">
          {onSelectAlert && (
            <button
              onClick={() => {
                onSelectAlert(alert);
                onDismiss();
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg neo-btn text-slate-200 hover:text-cyan-400 font-medium transition-colors"
            >
              Details
            </button>
          )}

          {onNavigateToDashboard && (
            <button
              onClick={() => {
                onNavigateToDashboard();
                onDismiss();
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg neo-btn-primary text-slate-950 font-bold flex items-center gap-1 transition-all"
            >
              <span>SOC Dashboard</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Progress countdown bar */}
      <div className="w-full bg-slate-900/80 h-1 mt-3 rounded-full overflow-hidden">
        <div
          className={`h-full ${style.progressBg} transition-all duration-75`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
