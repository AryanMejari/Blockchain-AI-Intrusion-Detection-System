import React, { useEffect, useState } from 'react';
import {
  Shield,
  Activity,
  AlertTriangle,
  Flame,
  UserX,
  Compass,
  ArrowLeft,
  RotateCw,
  Radio,
  Clock,
  Layers,
  Sparkles,
  BarChart3,
  RotateCcw,
  Volume2,
  VolumeX,
  CheckCircle2,
  Cpu,
} from 'lucide-react';
import {
  SecurityAlert,
  SecurityEvent,
  Metrics,
  InvestigationData,
  fetchAlerts,
  fetchEvents,
  fetchMetrics,
  fetchInvestigation,
  updateAlertStatus,
  createDashboardWebSocket,
  resetSystemTelemetry,
} from '../lib/api';
import { EventStream } from '../components/EventStream';
import { AlertCenter } from '../components/AlertCenter';
import { ReasoningInspector } from '../components/ReasoningInspector';
import { AttackTimeline } from '../components/AttackTimeline';
import { RelationshipGraph } from '../components/RelationshipGraph';
import {
  AdminToastContainer,
  ToastItem,
  playAlertChime,
} from '../components/AdminToastContainer';

interface DashboardPageProps {
  onNavigateToLogin: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToLogin }) => {
  const [metrics, setMetrics] = useState<Metrics>({
    total_events: 0,
    failed_logins: 0,
    active_alerts: 0,
    critical_alerts: 0,
    high_alerts: 0,
    medium_alerts: 0,
    low_alerts: 0,
    suspicious_accounts: 0,
    investigations_in_progress: 0,
  });

  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [investigationData, setInvestigationData] = useState<InvestigationData>({
    timeline: [],
    graph: { nodes: [], edges: [] },
  });

  const [isPaused, setIsPaused] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'timeline' | 'graph'>('console');
  const [wsConnected, setWsConnected] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const loadData = async () => {
    try {
      const [m, a, e, inv] = await Promise.all([
        fetchMetrics(),
        fetchAlerts(),
        fetchEvents({ limit: 100 }),
        fetchInvestigation('active'),
      ]);
      setMetrics(m);
      setAlerts(a);
      if (!isPaused) {
        setEvents(e.events || []);
      }
      setInvestigationData(inv);
      if (a.length > 0 && !selectedAlert) {
        setSelectedAlert(a[0]);
      } else if (a.length === 0) {
        setSelectedAlert(null);
      }
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  const triggerAlertToast = (alert: SecurityAlert) => {
    setToasts((prev) => {
      if (prev.some((t) => t.alert.id === alert.id)) return prev;
      if (audioEnabled) {
        playAlertChime(alert.severity);
      }
      const newToast: ToastItem = {
        id: Math.random().toString(),
        alert,
        createdAt: Date.now(),
        durationMs: 9000,
      };
      return [newToast, ...prev.slice(0, 3)];
    });
  };

  useEffect(() => {
    loadData();

    // Establish live WebSocket connection with auto-reconnect
    const ws = createDashboardWebSocket(
      (data) => {
        if (data.type === 'INITIAL_SNAPSHOT') {
          if (data.metrics) setMetrics(data.metrics);
          if (data.alerts) {
            setAlerts(data.alerts);
            if (data.alerts.length > 0 && !selectedAlert) {
              setSelectedAlert(data.alerts[0]);
            }
          }
        } else if (data.type === 'STATE_RESET') {
          // Reset to clean 0 state
          setMetrics({
            total_events: 0,
            failed_logins: 0,
            active_alerts: 0,
            critical_alerts: 0,
            high_alerts: 0,
            medium_alerts: 0,
            low_alerts: 0,
            suspicious_accounts: 0,
            investigations_in_progress: 0,
          });
          setAlerts([]);
          setEvents([]);
          setSelectedAlert(null);
          setInvestigationData({ timeline: [], graph: { nodes: [], edges: [] } });
          setToasts([]);
        } else {
          // New event or scenario execution - trigger refresh and toast
          loadData();
          if (data.latest_alert) {
            triggerAlertToast(data.latest_alert);
          } else if (data.alerts && data.alerts.length > 0) {
            triggerAlertToast(data.alerts[0]);
          }
        }
      },
      () => setWsConnected(true),
      () => setWsConnected(false)
    );

    return () => {
      ws.disconnect();
    };
  }, [isPaused, audioEnabled]);

  const handleStatusChange = async (
    alertId: string,
    status: 'new' | 'investigating' | 'resolved' | 'false_positive'
  ) => {
    try {
      const updated = await updateAlertStatus(alertId, status);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
      if (selectedAlert?.id === alertId) {
        setSelectedAlert(updated);
      }
      const m = await fetchMetrics();
      setMetrics(m);
    } catch (err) {
      console.error('Failed to update alert status:', err);
    }
  };

  const handleReset = async () => {
    try {
      await resetSystemTelemetry();
      await loadData();
      setToasts([]);
    } catch (err) {
      console.error('Failed to reset telemetry:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c101c] text-slate-100 flex flex-col font-sans relative overflow-x-hidden">
      {/* Background Cyber Mesh */}
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

      {/* Admin Real-Time Alert Toasts */}
      <AdminToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        onSelectAlert={(a) => {
          setSelectedAlert(a);
          setActiveTab('console');
        }}
      />

      {/* Top Header Bar */}
      <header className="px-6 py-3.5 border-b border-white/[0.04] bg-[#0f1423]/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl neo-btn flex items-center justify-center font-bold text-cyan-400">
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wider text-slate-100 flex items-center gap-2">
              SENTINEL SOC
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-700/60 flex items-center gap-1">
                <Cpu className="w-3 h-3 text-cyan-400" />
                SWI-PROLOG REASONER
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Autonomous Triage & Symbolic Correlation Console
            </div>
          </div>
        </div>

        {/* Center Indicators */}
        <div className="hidden sm:flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl neo-well text-slate-300">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{wsConnected ? 'WebSocket Live Telemetry' : 'Connecting stream...'}</span>
          </div>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl neo-well text-slate-300">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Prolog Engine: Active</span>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2.5">
          {/* Audio Chime Toggle */}
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className="p-2 rounded-xl neo-btn text-slate-400 hover:text-slate-200 transition-colors"
            title={audioEnabled ? 'Alert chimes enabled' : 'Alert chimes muted'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Refresh Data */}
          <button
            onClick={loadData}
            title="Refresh telemetry"
            className="p-2 rounded-xl neo-btn text-slate-300 hover:text-cyan-400 transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Clean / Reset Telemetry */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl neo-btn text-xs text-slate-300 hover:text-rose-400 transition-colors"
            title="Reset telemetry and alerts store to 0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clean Telemetry</span>
          </button>

          {/* Back to Login & Attack Simulator */}
          <button
            onClick={onNavigateToLogin}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl neo-btn-primary text-slate-950 text-xs font-bold transition-all shadow-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Attack Simulator</span>
          </button>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto space-y-6 relative z-10">
        
        {/* A. Neomorphic Overview Metrics Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          
          {/* Card 1: Total Events */}
          <div className="neo-card rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-2">
              <span>Total Telemetry</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="neo-well rounded-xl px-3 py-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold font-mono text-slate-100">{metrics.total_events}</span>
              <span className="text-[10px] text-slate-500 font-mono">RECORDS</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-2">Ingested security events</div>
          </div>

          {/* Card 2: Failed Logins */}
          <div className="neo-card rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-2">
              <span>Failed Logins</span>
              <AlertTriangle className="w-4 h-4 text-orange-400" />
            </div>
            <div className="neo-well rounded-xl px-3 py-2 flex items-baseline justify-between">
              <span className={`text-2xl font-bold font-mono ${metrics.failed_logins > 0 ? 'text-orange-400' : 'text-slate-400'}`}>
                {metrics.failed_logins}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">FAILURES</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-2">Auth attempts rejected</div>
          </div>

          {/* Card 3: Active Alerts */}
          <div className="neo-card rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-2">
              <span>Active Alerts</span>
              <Flame className="w-4 h-4 text-rose-400" />
            </div>
            <div className="neo-well rounded-xl px-3 py-2 flex items-baseline justify-between">
              <span className={`text-2xl font-bold font-mono ${metrics.active_alerts > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {metrics.active_alerts}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">INCIDENTS</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-2">Prolog rule triggers</div>
          </div>

          {/* Card 4: Severity Split */}
          <div className="neo-card rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-2">
              <span>Severity Split</span>
              <Layers className="w-4 h-4 text-purple-400" />
            </div>
            <div className="neo-well rounded-xl px-3 py-2 flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-rose-400">
                {metrics.critical_alerts} <small className="text-[10px] text-slate-400 font-normal">Crit</small>
              </span>
              <span className="text-sm font-bold font-mono text-orange-400">
                / {metrics.high_alerts} <small className="text-[10px] text-slate-400 font-normal">High</small>
              </span>
            </div>
            <div className="text-[10px] text-slate-500 mt-2">Risk triage hierarchy</div>
          </div>

          {/* Card 5: Suspicious Accounts */}
          <div className="neo-card rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-2">
              <span>Flagged Users</span>
              <UserX className="w-4 h-4 text-amber-400" />
            </div>
            <div className="neo-well rounded-xl px-3 py-2 flex items-baseline justify-between">
              <span className={`text-2xl font-bold font-mono ${metrics.suspicious_accounts > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {metrics.suspicious_accounts}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">IDENTITIES</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-2">Correlated target subjects</div>
          </div>

          {/* Card 6: Investigations */}
          <div className="neo-card rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-2">
              <span>Investigations</span>
              <Compass className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="neo-well rounded-xl px-3 py-2 flex items-baseline justify-between">
              <span className={`text-2xl font-bold font-mono ${metrics.investigations_in_progress > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                {metrics.investigations_in_progress}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">ACTIVE</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-2">Autonomous action plans</div>
          </div>
        </section>

        {/* View Selection Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('console')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'console'
                  ? 'neo-btn-primary text-slate-950 font-bold'
                  : 'neo-btn text-slate-300 hover:text-slate-100'
              }`}
            >
              Alerts & AI Reasoning Inspector
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'timeline'
                  ? 'neo-btn-primary text-slate-950 font-bold'
                  : 'neo-btn text-slate-300 hover:text-slate-100'
              }`}
            >
              Attack Chronology & Timeline
            </button>

            <button
              onClick={() => setActiveTab('graph')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'graph'
                  ? 'neo-btn-primary text-slate-950 font-bold'
                  : 'neo-btn text-slate-300 hover:text-slate-100'
              }`}
            >
              Correlation Entity Graph
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-mono">
            {lastRefreshed ? `Synchronized at ${lastRefreshed}` : ''}
          </div>
        </div>

        {/* Tab 1: Primary SOC Console (Split Screen) */}
        {activeTab === 'console' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Alert Center (cols 12 -> 5) */}
            <div className="lg:col-span-5 h-[680px]">
              <AlertCenter
                alerts={alerts}
                selectedAlertId={selectedAlert?.id || null}
                onSelectAlert={(a) => setSelectedAlert(a)}
                onStatusChange={handleStatusChange}
              />
            </div>

            {/* Right Column: Reasoning Inspector (cols 12 -> 7) */}
            <div className="lg:col-span-7 h-[680px]">
              <ReasoningInspector alert={selectedAlert} />
            </div>
          </div>
        )}

        {/* Tab 2: Attack Chronology & Timeline */}
        {activeTab === 'timeline' && (
          <div className="h-[680px]">
            <AttackTimeline
              timeline={investigationData.timeline}
              activeAlertId={selectedAlert?.id}
            />
          </div>
        )}

        {/* Tab 3: Correlation Entity Graph */}
        {activeTab === 'graph' && (
          <div className="h-[680px]">
            <RelationshipGraph
              graph={investigationData.graph}
              subject={selectedAlert?.subject}
            />
          </div>
        )}

        {/* Bottom Section: Live Telemetry Stream */}
        <section className="h-[420px]">
          <EventStream
            events={events}
            isPaused={isPaused}
            onTogglePause={() => setIsPaused(!isPaused)}
          />
        </section>
      </main>

      {/* Safety & Architecture Footer */}
      <footer className="relative z-10 w-full px-6 py-3.5 border-t border-white/[0.04] bg-[#0c101c]/90 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-cyan-500" />
          <span>Sentinel Security Operations Center — Powered by SWI-Prolog Symbolic Reasoning</span>
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          Clean Minimalist Neomorphism Core v2.0
        </div>
      </footer>
    </div>
  );
};
