import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  Flame,
  AlertTriangle,
  Play,
  Square,
  Activity,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Terminal,
  HelpCircle,
  RotateCcw,
  Volume2,
  VolumeX,
  Radio,
  Cpu,
  Layers,
  Sparkles,
  Server,
  Zap,
} from 'lucide-react';
import {
  login,
  resetSystemTelemetry,
  createDashboardWebSocket,
  SecurityAlert,
  SecurityEvent,
} from '../lib/api';
import {
  AdminToastContainer,
  ToastItem,
  playAlertChime,
} from '../components/AdminToastContainer';

interface LoginPageProps {
  onNavigateToDashboard: () => void;
}

interface AttackOption {
  id: string;
  name: string;
  category: string;
  severityLabel: string;
  description: string;
  defaultTarget: string;
  defaultSource: string;
  expectedRule: string;
  stepsCount: number;
  steps: Array<{
    user: string;
    pass: string;
    source?: string;
    context?: string;
    description: string;
  }>;
}

const ATTACK_SCENARIOS: AttackOption[] = [
  {
    id: 'brute_force',
    name: 'Targeted Password Brute Force',
    category: 'Credential Access',
    severityLabel: 'HIGH RISK',
    description: 'Rapid sequential dictionary password guesses against a single account until Prolog failure threshold (>=5) triggers.',
    defaultTarget: 'alice',
    defaultSource: '192.168.1.105',
    expectedRule: 'repeated_failed_logins',
    stepsCount: 6,
    steps: [
      { user: 'alice', pass: 'Password123', description: 'Trying dictionary word "Password123"' },
      { user: 'alice', pass: 'Sentinel2026', description: 'Trying company permutation "Sentinel2026"' },
      { user: 'alice', pass: 'Summer2026!', description: 'Trying seasonal password "Summer2026!"' },
      { user: 'alice', pass: 'Welcome123#', description: 'Trying default employee "Welcome123#"' },
      { user: 'alice', pass: 'AdminMaster99', description: 'Attempt 5: Breaches Prolog failure threshold' },
      { user: 'alice', pass: 'letmein2026!', description: 'Attempt 6: Triggers account lockout' },
    ],
  },
  {
    id: 'credential_spray',
    name: 'Distributed Credential Spray',
    category: 'Broad Reconnaissance',
    severityLabel: 'CRITICAL',
    description: 'Single attacker IP probes multiple distinct enterprise accounts with common passwords to evade per-account lockouts.',
    defaultTarget: 'multiple accounts',
    defaultSource: '10.14.22.88',
    expectedRule: 'credential_spray_from_source',
    stepsCount: 5,
    steps: [
      { user: 'alice', pass: 'CompanySpring2026!', description: 'Spraying username "alice"' },
      { user: 'bob', pass: 'CompanySpring2026!', description: 'Spraying username "bob"' },
      { user: 'j.singh', pass: 'CompanySpring2026!', description: 'Spraying username "j.singh"' },
      { user: 'svc-build', pass: 'CompanySpring2026!', description: 'Spraying service account "svc-build"' },
      { user: 'admin', pass: 'CompanySpring2026!', description: 'Spraying privileged account "admin"' },
    ],
  },
  {
    id: 'compromise_sequence',
    name: 'Brute Force to Intrusion Sequence',
    category: 'Account Takeover',
    severityLabel: 'CRITICAL',
    description: '4 failed password attempts followed by a successful off-hours sign-in (02:30 AM), simulating credential compromise.',
    defaultTarget: 'alice',
    defaultSource: '172.16.4.20',
    expectedRule: 'brute_force_then_success',
    stepsCount: 5,
    steps: [
      { user: 'alice', pass: 'test1_invalid', description: 'Fail probe 1/4' },
      { user: 'alice', pass: 'test2_invalid', description: 'Fail probe 2/4' },
      { user: 'alice', pass: 'test3_invalid', description: 'Fail probe 3/4' },
      { user: 'alice', pass: 'test4_invalid', description: 'Fail probe 4/4: Target password guessed' },
      { user: 'alice', pass: 'Sentinel@2026!', context: 'unusual_time', description: 'Intrusion: Successful login at off-hours (02:30 AM)' },
    ],
  },
  {
    id: 'suspicious_context',
    name: 'Anomalous Node / TOR Exit Access',
    category: 'Initial Access',
    severityLabel: 'MEDIUM',
    description: 'Valid authentication attempt originating from a high-risk simulated TOR exit node at off-hours.',
    defaultTarget: 'j.singh',
    defaultSource: 'tor-exit-sim-99',
    expectedRule: 'suspicious_source_access',
    stepsCount: 2,
    steps: [
      { user: 'j.singh', pass: 'wrong_secret', source: 'tor-exit-sim-99', context: 'unusual_time', description: 'Probe connection from TOR exit node' },
      { user: 'j.singh', pass: 'Finance#2026', source: 'tor-exit-sim-99', context: 'unusual_time', description: 'Authenticating valid session from anonymous node' },
    ],
  },
  {
    id: 'rate_limit_burst',
    name: 'High-Frequency Burst Flooding',
    category: 'Denial & Probing',
    severityLabel: 'MEDIUM',
    description: 'Rapid-fire burst of 10 requests in 2 seconds from a single IP to test firewall and rate-limit alarms.',
    defaultTarget: 'bot-probe',
    defaultSource: '203.0.113.42',
    expectedRule: 'rate_limit_exceeded',
    stepsCount: 8,
    steps: [
      { user: 'probe_01', pass: 'flood', description: 'Rapid probe burst 1' },
      { user: 'probe_02', pass: 'flood', description: 'Rapid probe burst 2' },
      { user: 'probe_03', pass: 'flood', description: 'Rapid probe burst 3' },
      { user: 'probe_04', pass: 'flood', description: 'Rapid probe burst 4' },
      { user: 'probe_05', pass: 'flood', description: 'Rapid probe burst 5' },
      { user: 'probe_06', pass: 'flood', description: 'Rapid probe burst 6' },
      { user: 'probe_07', pass: 'flood', description: 'Rapid probe burst 7' },
      { user: 'probe_08', pass: 'flood', description: 'Rapid probe burst 8: Rate limit barrier reached' },
    ],
  },
  {
    id: 'sql_injection',
    name: 'SQL Injection / Auth Bypass Probe',
    category: 'Injection Exploit',
    severityLabel: 'HIGH RISK',
    description: 'Attacker injects SQL tautology and union strings attempting authentication bypass.',
    defaultTarget: "' OR '1'='1' --",
    defaultSource: '198.51.100.27',
    expectedRule: 'repeated_failed_logins',
    stepsCount: 4,
    steps: [
      { user: "' OR '1'='1' --", pass: 'admin_bypass', description: 'Payload: \' OR \'1\'=\'1\' --' },
      { user: "admin' --", pass: 'comment_out', description: 'Payload: admin\' --' },
      { user: "admin' /*", pass: 'inline_comment', description: 'Payload: admin\' /* block' },
      { user: "' UNION SELECT 'admin', 'hash' --", pass: 'union_bypass', description: 'Payload: UNION SELECT injection' },
    ],
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToDashboard }) => {
  // Login form state
  const [username, setUsername] = useState('alice');
  const [password, setPassword] = useState('Sentinel@2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [simulatedSource, setSimulatedSource] = useState('192.168.1.100');
  const [simulatedContext, setSimulatedContext] = useState('usual');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  // Attack simulator state
  const [selectedAttackId, setSelectedAttackId] = useState<string>('brute_force');
  const [customTarget, setCustomTarget] = useState<string>('alice');
  const [customSource, setCustomSource] = useState<string>('192.168.1.105');
  const [attackSpeedMs, setAttackSpeedMs] = useState<number>(750);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [executionLogs, setExecutionLogs] = useState<Array<{ id: string; time: string; msg: string; type: 'info' | 'fail' | 'success' | 'alert' }>>([]);
  const [executionStats, setExecutionStats] = useState<{ attempts: number; alertsFired: number } | null>(null);

  // Toasts & Alerts
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [alertsCount, setAlertsCount] = useState<number>(0);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Stop simulation control ref
  const abortSimRef = useRef<boolean>(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const activeScenario = ATTACK_SCENARIOS.find((s) => s.id === selectedAttackId) || ATTACK_SCENARIOS[0];

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [executionLogs]);

  // Sync default target & source when scenario changes
  useEffect(() => {
    if (!isSimulating) {
      setCustomTarget(activeScenario.defaultTarget);
      setCustomSource(activeScenario.defaultSource);
    }
  }, [selectedAttackId]);

  // Connect to live WebSocket for real-time AI alerts
  useEffect(() => {
    const ws = createDashboardWebSocket(
      (data) => {
        if (data.type === 'INITIAL_SNAPSHOT') {
          if (data.alerts) setAlertsCount(data.alerts.length);
        } else if (data.type === 'STATE_RESET') {
          setAlertsCount(0);
          setToasts([]);
          addExecutionLog('System telemetry and alert state reset to clean 0.', 'info');
        } else if (data.type === 'STATE_UPDATED' || data.type === 'SCENARIO_EXECUTED' || data.type === 'EVENT_INGESTED') {
          if (data.alerts_count !== undefined) {
            setAlertsCount(data.alerts_count);
          }
          if (data.latest_alert) {
            triggerNewAlertToast(data.latest_alert);
          } else if (data.alerts && data.alerts.length > 0) {
            triggerNewAlertToast(data.alerts[0]);
          }
        }
      },
      () => setWsConnected(true),
      () => setWsConnected(false)
    );

    return () => ws.disconnect();
  }, [audioEnabled]);

  const triggerNewAlertToast = (alert: SecurityAlert) => {
    // Avoid duplicate toasts
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

    addExecutionLog(`🚨 PROLOG AI ALERT: ${alert.title} (Rule: ${alert.rule})`, 'alert');
  };

  const addExecutionLog = (msg: string, type: 'info' | 'fail' | 'success' | 'alert' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setExecutionLogs((prev) => [...prev.slice(-30), { id: Math.random().toString(), time, msg, type }]);
  };

  // Standard interactive login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setFeedback({ type: 'error', message: 'Please enter both username and password.' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      const res = await login(username, password, simulatedSource, simulatedContext);
      if (res.status === 'success') {
        setFeedback({ type: 'success', message: res.message });
        addExecutionLog(`Manual Auth Success: '${username}' from ${simulatedSource}`, 'success');
      } else if (res.status === 'lockout') {
        setFeedback({ type: 'error', message: res.message });
        addExecutionLog(`Manual Auth Lockout: '${username}' exceeded maximum failures`, 'alert');
      } else {
        setFeedback({ type: 'error', message: res.message || 'Invalid credentials.' });
        addExecutionLog(`Manual Auth Failure: '${username}' from ${simulatedSource}`, 'fail');
      }

      if (res.pipeline?.alerts && res.pipeline.alerts.length > 0) {
        setAlertsCount(res.pipeline.alerts.length);
        triggerNewAlertToast(res.pipeline.alerts[0]);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Authentication service unreachable.' });
      addExecutionLog(`Network Error during login transmission`, 'fail');
    } finally {
      setIsLoading(false);
    }
  };

  // Live Attack Simulation Execution
  const startLiveAttackSimulation = async () => {
    if (isSimulating) return;

    abortSimRef.current = false;
    setIsSimulating(true);
    setCurrentStepIndex(0);
    setExecutionStats({ attempts: 0, alertsFired: 0 });
    setFeedback(null);

    addExecutionLog(`=== INITIATING ATTACK: ${activeScenario.name} ===`, 'info');
    addExecutionLog(`Vector: ${activeScenario.category} | Expected Rule: ${activeScenario.expectedRule}`, 'info');

    let firedAlerts = 0;

    for (let i = 0; i < activeScenario.steps.length; i++) {
      if (abortSimRef.current) {
        addExecutionLog(`Simulation aborted by user at step ${i + 1}/${activeScenario.steps.length}`, 'fail');
        break;
      }

      setCurrentStepIndex(i + 1);
      const step = activeScenario.steps[i];
      const targetUser = activeScenario.id === 'credential_spray' ? step.user : customTarget || step.user;
      const targetPass = step.pass;
      const stepSource = step.source || customSource || activeScenario.defaultSource;
      const stepContext = step.context || 'usual';

      // Visual typing effect onto the login card inputs
      setUsername(targetUser);
      setPassword(targetPass);
      setSimulatedSource(stepSource);

      const startTime = performance.now();

      try {
        addExecutionLog(
          `› [${i + 1}/${activeScenario.steps.length}] POST /api/auth/login | Target: "${targetUser}" | Payload: "${targetPass}" | IP: ${stepSource}`,
          'info'
        );

        const res = await login(targetUser, targetPass, stepSource, stepContext);
        const elapsed = Math.round(performance.now() - startTime);

        if (res.status === 'success') {
          addExecutionLog(
            `← [200 OK] Auth Success for "${targetUser}" in ${elapsed}ms (${step.description})`,
            'success'
          );
        } else if (res.status === 'lockout') {
          addExecutionLog(
            `← [423 Locked] Account Lockout triggered for "${targetUser}" in ${elapsed}ms`,
            'alert'
          );
        } else {
          addExecutionLog(
            `← [401 Unauthorized] Attempt failed in ${elapsed}ms: ${res.message || 'Bad credentials'}`,
            'fail'
          );
        }

        // Check if Prolog triggered alerts on this step
        const currentAlerts = res.pipeline?.alerts || [];
        if (currentAlerts.length > 0) {
          firedAlerts = currentAlerts.length;
          setAlertsCount(firedAlerts);
          triggerNewAlertToast(currentAlerts[0]);
        }

        setExecutionStats({ attempts: i + 1, alertsFired: firedAlerts });
      } catch (err: any) {
        addExecutionLog(`← Request Error: ${err.message}`, 'fail');
      }

      // Delay between steps for live visual progression
      if (i < activeScenario.steps.length - 1 && !abortSimRef.current) {
        await new Promise((resolve) => setTimeout(resolve, attackSpeedMs));
      }
    }

    if (!abortSimRef.current) {
      addExecutionLog(`=== ATTACK EXECUTION COMPLETE (${activeScenario.steps.length} attempts dispatched) ===`, 'info');
      setFeedback({
        type: 'info',
        message: `Simulation "${activeScenario.name}" completed. Telemetry evaluated by SWI-Prolog in real-time.`,
      });
    }

    setIsSimulating(false);
    setCurrentStepIndex(-1);
  };

  const stopAttackSimulation = () => {
    abortSimRef.current = true;
    setIsSimulating(false);
    addExecutionLog('Stopping simulation sequence...', 'info');
  };

  const handleResetTelemetry = async () => {
    try {
      await resetSystemTelemetry();
      setAlertsCount(0);
      setToasts([]);
      setExecutionLogs([]);
      setExecutionStats(null);
      setFeedback({ type: 'info', message: 'All telemetry and security alert history wiped clean.' });
      addExecutionLog('Telemetry store cleared to initial 0 state.', 'info');
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Failed to reset telemetry' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0c101c] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background Cyber Mesh */}
      <div className="absolute inset-0 grid-bg opacity-35 pointer-events-none" />

      {/* Admin Realtime Toast Notifications */}
      <AdminToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        onNavigateToDashboard={onNavigateToDashboard}
      />

      {/* Top Header Bar */}
      <header className="relative z-20 w-full px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.04] bg-[#0f1423]/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl neo-btn flex items-center justify-center font-black text-cyan-400">
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-wider text-slate-100 flex items-center gap-2">
              SENTINEL ACCESS PORTAL
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-700/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                ACTIVE HONEYPOT / MONITORED
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Interactive Attack Simulation & SWI-Prolog Telemetry Ingestion
            </div>
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

          {/* Clean / Reset Telemetry Button */}
          <button
            onClick={handleResetTelemetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl neo-btn text-xs text-slate-300 hover:text-rose-400 transition-colors"
            title="Wipe all security events and alerts to clean slate"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Clean Telemetry</span>
          </button>

          {/* SOC Dashboard Link */}
          <button
            onClick={onNavigateToDashboard}
            className="flex items-center gap-2 px-4 py-2 rounded-xl neo-btn-primary text-slate-950 font-bold text-xs transition-all shadow-lg"
          >
            <span>SOC Dashboard</span>
            {alertsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
                {alertsCount}
              </span>
            )}
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>
      </header>

      {/* Main Dual Column Layout */}
      <main className="relative z-10 max-w-7xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1">
        
        {/* Left Column: Monitored Authentication Card (cols 12 -> 5) */}
        <div className="lg:col-span-5 neo-card rounded-2xl p-6 sm:p-7 shadow-2xl relative">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Enterprise Sign-In</span>
                {isSimulating && (
                  <span className="text-[10px] font-mono text-rose-400 bg-rose-950/70 px-2 py-0.5 rounded-full border border-rose-800 animate-pulse flex items-center gap-1">
                    <Zap className="w-3 h-3" /> ATTACK STREAM ACTIVE
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Monitored endpoint. Telemetry fed directly into Prolog reasoning pipeline.
              </p>
            </div>
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`mb-4 p-3 rounded-xl text-xs flex items-start gap-2.5 transition-all ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                  : feedback.type === 'error'
                  ? 'bg-rose-950/80 border border-rose-800 text-rose-300'
                  : 'bg-cyan-950/80 border border-cyan-800 text-cyan-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : feedback.type === 'error' ? (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{feedback.message}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username / Account ID
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alice, bob, j.singh"
                  disabled={isSimulating}
                  className={`w-full neo-well rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all ${
                    isSimulating ? 'border-rose-500/50 text-rose-200' : ''
                  }`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                >
                  <HelpCircle className="w-3 h-3" /> Demo credentials
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={isSimulating}
                  className={`w-full neo-well rounded-xl pl-10 pr-10 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all ${
                    isSimulating ? 'border-rose-500/50 text-rose-200' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Demo Credentials Helper Dropdown */}
            {showDemoAccounts && (
              <div className="p-3.5 rounded-xl neo-well text-xs space-y-1.5 font-mono text-slate-300 border border-cyan-800/40">
                <div className="text-[10px] font-sans font-bold text-cyan-400 uppercase tracking-wider mb-1">
                  Synthetic Demo Accounts (Stored in SQLite)
                </div>
                <div
                  className="cursor-pointer hover:text-cyan-400 py-0.5"
                  onClick={() => {
                    setUsername('alice');
                    setPassword('Sentinel@2026!');
                  }}
                >
                  • <span className="font-semibold text-slate-200">alice</span> / Sentinel@2026! (Security Analyst)
                </div>
                <div
                  className="cursor-pointer hover:text-cyan-400 py-0.5"
                  onClick={() => {
                    setUsername('bob');
                    setPassword('Password123!');
                  }}
                >
                  • <span className="font-semibold text-slate-200">bob</span> / Password123! (Engineering)
                </div>
                <div
                  className="cursor-pointer hover:text-cyan-400 py-0.5"
                  onClick={() => {
                    setUsername('j.singh');
                    setPassword('Finance#2026');
                  }}
                >
                  • <span className="font-semibold text-slate-200">j.singh</span> / Finance#2026 (Finance Ops)
                </div>
              </div>
            )}

            {/* Telemetry Simulator Context */}
            <div className="pt-2 grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Simulated Source IP</label>
                <input
                  type="text"
                  value={simulatedSource}
                  onChange={(e) => setSimulatedSource(e.target.value)}
                  disabled={isSimulating}
                  className="w-full neo-well rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Context Simulation</label>
                <select
                  value={simulatedContext}
                  onChange={(e) => setSimulatedContext(e.target.value)}
                  disabled={isSimulating}
                  className="w-full neo-well rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:border-cyan-500"
                >
                  <option value="usual">Standard Business Hours</option>
                  <option value="unusual_time">Off-Hours (02:00 AM)</option>
                  <option value="suspicious_source">Suspicious Node Context</option>
                </select>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
                />
                Remember workstation
              </label>
              <button
                type="button"
                onClick={() => alert('Demo recovery: Controlled security simulation.')}
                className="text-cyan-400 hover:underline"
              >
                Reset password?
              </button>
            </div>

            {/* Submit Auth Button */}
            <button
              type="submit"
              disabled={isLoading || isSimulating}
              className="w-full py-2.5 rounded-xl neo-btn font-bold text-xs text-slate-200 hover:text-cyan-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-1"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span>Transmitting Telemetry...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>Authenticate Session</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Live Attack Simulation Lab (cols 12 -> 7) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Attack Control Card */}
          <div className="neo-card rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.04] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-orange-950/80 border border-orange-800/80 flex items-center justify-center text-orange-400">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
                    Live Attack Simulation Lab
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Execute adversarial sequences and observe real-time Prolog inference
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono font-bold text-orange-400 bg-orange-950/60 px-2.5 py-1 rounded-full border border-orange-800/80 neo-pill">
                SAFE SANDBOX
              </span>
            </div>

            {/* Attack Dropdown Selection & Controls */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Select Attack Vector to Simulate</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {ATTACK_SCENARIOS.length} Scenarios Available
                  </span>
                </label>

                {/* Dropdown Selector */}
                <div className="relative">
                  <select
                    value={selectedAttackId}
                    onChange={(e) => setSelectedAttackId(e.target.value)}
                    disabled={isSimulating}
                    className="w-full neo-well rounded-xl px-4 py-3 text-sm text-slate-100 font-medium appearance-none focus:outline-none focus:border-cyan-500 transition-all cursor-pointer"
                  >
                    {ATTACK_SCENARIOS.map((scenario) => (
                      <option key={scenario.id} value={scenario.id} className="bg-slate-900 text-slate-100">
                        {scenario.name} — [{scenario.category}] ({scenario.severityLabel})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-4 top-3.5 text-slate-400 text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* Scenario Description Banner */}
              <div className="p-3.5 rounded-xl neo-well text-xs border border-white/[0.03] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wide">
                    Scenario Dynamics:
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Rule: <span className="text-slate-200">{activeScenario.expectedRule}</span>
                  </span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">
                  {activeScenario.description}
                </p>
              </div>

              {/* Target & Speed Configuration Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Target Account</label>
                  <input
                    type="text"
                    value={customTarget}
                    onChange={(e) => setCustomTarget(e.target.value)}
                    disabled={isSimulating || activeScenario.id === 'credential_spray'}
                    className="w-full neo-well rounded-lg px-3 py-2 text-slate-200 text-xs font-mono focus:border-cyan-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Attacker IP</label>
                  <input
                    type="text"
                    value={customSource}
                    onChange={(e) => setCustomSource(e.target.value)}
                    disabled={isSimulating}
                    className="w-full neo-well rounded-lg px-3 py-2 text-slate-200 text-xs font-mono focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Execution Speed</label>
                  <select
                    value={attackSpeedMs}
                    onChange={(e) => setAttackSpeedMs(Number(e.target.value))}
                    disabled={isSimulating}
                    className="w-full neo-well rounded-lg px-2.5 py-2 text-slate-200 text-xs focus:border-cyan-500"
                  >
                    <option value={1000}>1.0s (Step-by-step)</option>
                    <option value={750}>0.75s (Recommended)</option>
                    <option value={400}>0.4s (Rapid Probe)</option>
                  </select>
                </div>
              </div>

              {/* Primary Action Button (Start / Stop) */}
              <div className="pt-2">
                {!isSimulating ? (
                  <button
                    onClick={startLiveAttackSimulation}
                    className="w-full py-3 rounded-xl neo-btn-danger text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-xl"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Start Attack Simulation</span>
                  </button>
                ) : (
                  <button
                    onClick={stopAttackSimulation}
                    className="w-full py-3 rounded-xl neo-btn text-rose-400 hover:text-rose-300 font-bold text-sm transition-all flex items-center justify-center gap-2 border border-rose-800/80"
                  >
                    <Square className="w-4 h-4 fill-rose-400" />
                    <span>Stop Simulation</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Live Attack Execution Visualizer & Terminal */}
          <div className="neo-card rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold tracking-wider uppercase text-slate-200">
                  Live Execution Feed & Reasoning Telemetry
                </h3>
              </div>

              <div className="flex items-center gap-3">
                {isSimulating && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-[11px] font-mono text-rose-400 font-semibold">
                      STEP {currentStepIndex} / {activeScenario.steps.length}
                    </span>
                  </div>
                )}
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-white/[0.05]">
                  Active Telemetry Records: {executionLogs.length}
                </span>
              </div>
            </div>

            {/* Live Progress Bar */}
            {isSimulating && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Attack Execution Progress</span>
                  <span>{Math.round((currentStepIndex / activeScenario.steps.length) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden neo-well p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-rose-500 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(244,63,94,0.5)]"
                    style={{ width: `${(currentStepIndex / activeScenario.steps.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Terminal Window */}
            <div className="neo-well rounded-xl p-4 font-mono text-[11px] h-60 overflow-y-auto space-y-1.5 scrollbar-thin">
              {executionLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
                  <Cpu className="w-8 h-8 text-slate-700" />
                  <p>Select an attack vector above and click "Start Attack Simulation".</p>
                  <p className="text-[10px] text-slate-600">
                    Each attempt will execute live before you and trigger SWI-Prolog reasoning.
                  </p>
                </div>
              ) : (
                <>
                  {executionLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`flex items-start gap-2 leading-relaxed ${
                        log.type === 'alert'
                          ? 'text-rose-400 font-bold bg-rose-950/40 p-1 rounded'
                          : log.type === 'fail'
                          ? 'text-amber-300'
                          : log.type === 'success'
                          ? 'text-emerald-300'
                          : 'text-slate-300'
                      }`}
                    >
                      <span className="text-slate-600 select-none text-[10px]">{log.time}</span>
                      <span className="break-all">{log.msg}</span>
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </>
              )}
            </div>

            {/* Quick Stats Footnote */}
            {executionStats && (
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div className="p-2.5 rounded-xl neo-well flex items-center justify-between">
                  <span className="text-slate-400">Total Attempts Sent:</span>
                  <span className="font-mono font-bold text-slate-200">{executionStats.attempts}</span>
                </div>
                <div className="p-2.5 rounded-xl neo-well flex items-center justify-between">
                  <span className="text-slate-400">AI Alerts Triggered:</span>
                  <span className={`font-mono font-bold ${executionStats.alertsFired > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                    {executionStats.alertsFired}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Safety & Compliance Footer */}
      <footer className="relative z-10 w-full px-6 py-3.5 border-t border-white/[0.04] bg-[#0c101c]/90 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-cyan-500" />
          <span>Sentinel Controlled Educational Simulation. Real-time SWI-Prolog AI reasoning loop.</span>
        </div>
        <div className="font-mono text-[11px] text-slate-400 flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            WS {wsConnected ? 'Connected' : 'Offline'}
          </span>
          <span>Engine: SWI-Prolog 10.0</span>
        </div>
      </footer>
    </div>
  );
};
