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
} from '../lib/api';
import { EventStream } from '../components/EventStream';
import { AlertCenter } from '../components/AlertCenter';
import { ReasoningInspector } from '../components/ReasoningInspector';
import { AttackTimeline } from '../components/AttackTimeline';
import { RelationshipGraph } from '../components/RelationshipGraph';

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
      }
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    loadData();

    // Establish live WebSocket connection with auto-reconnect
    const ws = createDashboardWebSocket(
      (data) => {
        if (data.type === 'INITIAL_SNAPSHOT') {
          if (data.metrics) setMetrics(data.metrics);
          if (data.alerts) setAlerts(data.alerts);
        } else {
          // New event or scenario execution - trigger refresh
          loadData();
        }
      },
      () => setWsConnected(true),
      () => setWsConnected(false)
    );

    return () => {
      ws.disconnect();
    };
  }, [isPaused]);

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

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="px-6 py-3.5 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-slate-950 shadow-lg shadow-cyan-500/20">
            S
          </div>
          <div>
            <div className="text-sm font-bold tracking-wider text-slate-100 flex items-center gap-2">
              SENTINEL SOC <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">REASONING CORE</span>
            </div>
            <div className="text-[11px] text-slate-400">Security Operations & Autonomous Triage</div>
          </div>
        </div>

        {/* Center Engine Indicator */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            <span className="text-slate-300">
              {wsConnected ? 'WebSocket Live Feed' : 'Connecting Stream...'}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>SWI-Prolog Engine Online</span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            title="Refresh telemetry and inferences"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onNavigateToLogin}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Open Target Login</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto space-y-6">
        {/* A. Overview Metrics Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Card 1: Total Events */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Total Telemetry</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-slate-100">{metrics.total_events}</div>
            <div className="text-[11px] text-slate-500 mt-1">Ingested Records</div>
          </div>

          {/* Card 2: Failed Logins */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Failed Logins</span>
              <AlertTriangle className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-orange-400">{metrics.failed_logins}</div>
            <div className="text-[11px] text-slate-500 mt-1">Auth Failures</div>
          </div>

          {/* Card 3: Active Incidents */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Active Alerts</span>
              <Flame className="w-4 h-4 text-red-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-red-400">{metrics.active_alerts}</div>
            <div className="text-[11px] text-slate-500 mt-1">Needs Analyst Review</div>
          </div>

          {/* Card 4: Critical / High */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Severity Split</span>
              <Layers className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-xl font-bold text-red-400">{metrics.critical_alerts} <small className="text-[10px] uppercase">Crit</small></span>
              <span className="text-base font-bold text-orange-400">/ {metrics.high_alerts} <small className="text-[10px] uppercase">High</small></span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Priority Classification</div>
          </div>

          {/* Card 5: Suspicious Accounts */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Flagged Users</span>
              <UserX className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-400">{metrics.suspicious_accounts}</div>
            <div className="text-[11px] text-slate-500 mt-1">Correlated Identities</div>
          </div>

          {/* Card 6: Active Investigations */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Investigations</span>
              <Compass className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {metrics.investigations_in_progress}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Autonomous Plans</div>
          </div>
        </section>

        {/* View Selection Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('console')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'console'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Alerts & AI Reasoning Inspector
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'timeline'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Attack Progression Timeline
            </button>

            <button
              onClick={() => setActiveTab('graph')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                activeTab === 'graph'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Entity Relationship Graph
            </button>
          </div>

          <div className="text-xs text-slate-500 font-mono hidden sm:block">
            Last Synced: {lastRefreshed || '—'}
          </div>
        </div>

        {/* Tab 1: Primary SOC Console (Alerts + AI Inspector) */}
        {activeTab === 'console' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-6 h-full">
              <AlertCenter
                alerts={alerts}
                selectedAlertId={selectedAlert?.id || null}
                onSelectAlert={(a) => setSelectedAlert(a)}
                onStatusChange={handleStatusChange}
              />
            </div>
            <div className="lg:col-span-6 h-full">
              <ReasoningInspector alert={selectedAlert} />
            </div>
          </div>
        )}

        {/* Tab 2: Attack Timeline */}
        {activeTab === 'timeline' && (
          <div className="space-y-6">
            <AttackTimeline timeline={investigationData.timeline} />
          </div>
        )}

        {/* Tab 3: Relationship Graph */}
        {activeTab === 'graph' && (
          <div className="space-y-6">
            <RelationshipGraph
              nodes={investigationData.graph.nodes}
              edges={investigationData.graph.edges}
            />
          </div>
        )}

        {/* Bottom Section: Live Event Stream (Always visible for real-time visibility) */}
        <section className="pt-2">
          <EventStream
            events={events}
            isPaused={isPaused}
            onTogglePause={() => setIsPaused(!isPaused)}
            onSelectEvent={(ev) => {
              // Try finding associated alert
              const matching = alerts.find((a) => a.evidence_ids?.includes(ev.id));
              if (matching) setSelectedAlert(matching);
            }}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full px-6 py-4 border-t border-slate-800/80 bg-slate-950/70 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 mt-8">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-cyan-500" />
          <span>Sentinel Security Operations Console — Educational Rule-Based Reasoning</span>
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          Powered by SWI-Prolog & FastAPI
        </div>
      </footer>
    </div>
  );
};
