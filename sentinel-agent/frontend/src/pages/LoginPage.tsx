import React, { useState } from 'react';
import {
  Shield,
  Lock,
  User,
  Eye,
  EyeOff,
  Flame,
  AlertTriangle,
  Play,
  Activity,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Terminal,
  HelpCircle,
} from 'lucide-react';
import { login, runScenario } from '../lib/api';

interface LoginPageProps {
  onNavigateToDashboard: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigateToDashboard }) => {
  const [username, setUsername] = useState('alice');
  const [password, setPassword] = useState('Sentinel@2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [simulatedSource, setSimulatedSource] = useState('192.168.1.100');
  const [simulatedContext, setSimulatedContext] = useState('usual');

  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [activityLog, setActivityLog] = useState<Array<{ id: string; time: string; msg: string; type: string }>>([]);
  const [eventCount, setEventCount] = useState(0);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  const addLog = (msg: string, type: string) => {
    const time = new Date().toLocaleTimeString();
    setActivityLog((prev) => [{ id: Math.random().toString(), time, msg, type }, ...prev.slice(0, 7)]);
    setEventCount((prev) => prev + 1);
  };

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
        addLog(`Auth Success: '${username}' from ${simulatedSource}`, 'success');
      } else if (res.status === 'lockout') {
        setFeedback({ type: 'error', message: res.message });
        addLog(`Account Lockout: '${username}' exceeded maximum failures`, 'lockout');
      } else {
        setFeedback({ type: 'error', message: res.message || 'Invalid credentials.' });
        addLog(`Auth Failure: '${username}' from ${simulatedSource}`, 'failure');
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Authentication service unreachable.' });
      addLog(`Network/Server Error during login attempt`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerScenario = async (scenarioId: string, desc: string) => {
    setIsLoading(true);
    try {
      const res = await runScenario(scenarioId);
      addLog(`Attack Lab: Executed '${desc}' (${res.events_count} events)`, 'scenario');
      setFeedback({
        type: 'info',
        message: `Simulation '${desc}' generated ${res.events_count} telemetry records and updated Prolog reasoning.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Scenario failed: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background cyber grid */}
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none"></div>

      {/* Top Header */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 font-bold text-slate-950">
            S
          </div>
          <div>
            <div className="text-sm font-bold tracking-wider text-slate-100 flex items-center gap-2">
              SENTINEL LABS <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800">MONITORED TARGET</span>
            </div>
            <div className="text-[11px] text-slate-400">Enterprise Access Portal</div>
          </div>
        </div>

        <button
          onClick={onNavigateToDashboard}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-cyan-500/20"
        >
          <span>Open SOC Dashboard</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-6xl mx-auto w-full px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Realistic Login Card (cols 12 -> 6) */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-100">Sign in to Sentinel Labs</h1>
            <p className="text-xs text-slate-400 mt-1">
              All authentication attempts are actively monitored by the SWI-Prolog reasoning agent.
            </p>
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`mb-5 p-3 rounded-lg text-xs flex items-start gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300'
                  : feedback.type === 'error'
                  ? 'bg-red-950/80 border border-red-800 text-red-300'
                  : 'bg-cyan-950/80 border border-cyan-800 text-cyan-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : feedback.type === 'error' ? (
                <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              ) : (
                <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username / Email */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Username or Synthetic Account
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alice, bob, j.singh"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                  className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <HelpCircle className="w-3 h-3" /> Demo credentials
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-10 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Demo Credentials Helper Dropdown */}
            {showDemoAccounts && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1 font-mono text-slate-300">
                <div className="text-[11px] font-sans font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Synthetic Accounts (Pre-hashed in DB)
                </div>
                <div
                  className="cursor-pointer hover:text-cyan-400"
                  onClick={() => {
                    setUsername('alice');
                    setPassword('Sentinel@2026!');
                  }}
                >
                  • <span className="font-semibold text-slate-200">alice</span> / Sentinel@2026! (Analyst)
                </div>
                <div
                  className="cursor-pointer hover:text-cyan-400"
                  onClick={() => {
                    setUsername('bob');
                    setPassword('Password123!');
                  }}
                >
                  • <span className="font-semibold text-slate-200">bob</span> / Password123! (Engineering)
                </div>
                <div
                  className="cursor-pointer hover:text-cyan-400"
                  onClick={() => {
                    setUsername('j.singh');
                    setPassword('Finance#2026');
                  }}
                >
                  • <span className="font-semibold text-slate-200">j.singh</span> / Finance#2026 (Finance)
                </div>
              </div>
            )}

            {/* Advanced Context Simulator */}
            <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Simulated Source IP</label>
                <input
                  type="text"
                  value={simulatedSource}
                  onChange={(e) => setSimulatedSource(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Context Simulation</label>
                <select
                  value={simulatedContext}
                  onChange={(e) => setSimulatedContext(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:border-cyan-500"
                >
                  <option value="usual">Usual Working Hours</option>
                  <option value="unusual_time">Unusual Local Time (02:00 AM)</option>
                  <option value="suspicious_source">Suspicious Source Context</option>
                </select>
              </div>
            </div>

            {/* Remember & Recover */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
                />
                Remember this workstation
              </label>
              <button
                type="button"
                onClick={() => alert('Demo simulated recovery: contact security lab supervisor.')}
                className="text-cyan-400 hover:underline"
              >
                Reset password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Transmitting Telemetry...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Authenticate Session</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Demo Attack Lab & Activity Log (cols 12 -> 6) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Attack Simulation Panel */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-100">
                  Demo Attack Lab (Safe Simulation)
                </h2>
              </div>
              <span className="text-[11px] font-mono text-orange-400 bg-orange-950/60 px-2 py-0.5 rounded border border-orange-800">
                LOCAL ONLY
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Trigger pre-configured adversarial telemetry scenarios to demonstrate real-time Prolog detection, correlation, and explanation generation on the dashboard.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => triggerScenario('repeated_failures', '6 Repeated Failed Logins')}
                disabled={isLoading}
                className="p-3 text-left rounded-xl bg-slate-950 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-800/40 transition-all text-xs group"
              >
                <div className="font-semibold text-slate-200 group-hover:text-orange-400 flex items-center gap-1.5">
                  <Play className="w-3 h-3 text-orange-400" /> 1. Repeated Failures
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  6 failed logins against single user. Triggers brute force alert.
                </div>
              </button>

              <button
                onClick={() => triggerScenario('multiple_accounts', 'Credential Spray from Single IP')}
                disabled={isLoading}
                className="p-3 text-left rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/40 transition-all text-xs group"
              >
                <div className="font-semibold text-slate-200 group-hover:text-cyan-400 flex items-center gap-1.5">
                  <Play className="w-3 h-3 text-cyan-400" /> 2. Credential Spray
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Single source IP attempts 5 distinct synthetic usernames.
                </div>
              </button>

              <button
                onClick={() => triggerScenario('successful_after_failures', 'Compromise After Failures')}
                disabled={isLoading}
                className="p-3 text-left rounded-xl bg-slate-950 border border-slate-800 hover:border-red-500/50 hover:bg-slate-800/40 transition-all text-xs group"
              >
                <div className="font-semibold text-slate-200 group-hover:text-red-400 flex items-center gap-1.5">
                  <Play className="w-3 h-3 text-red-400" /> 3. Compromise Sequence
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  4 failures followed by off-hour sign-in. Triggers critical alert.
                </div>
              </button>

              <button
                onClick={() => triggerScenario('suspicious_context', 'Anomalous Source / Time')}
                disabled={isLoading}
                className="p-3 text-left rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/40 transition-all text-xs group"
              >
                <div className="font-semibold text-slate-200 group-hover:text-amber-400 flex items-center gap-1.5">
                  <Play className="w-3 h-3 text-amber-400" /> 4. Suspicious Context
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Off-hours sign-in from anomalous simulated node.
                </div>
              </button>

              <button
                onClick={() => triggerScenario('rate_limit_burst', 'High Request Density Burst')}
                disabled={isLoading}
                className="col-span-1 sm:col-span-2 p-3 text-left rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-800/40 transition-all text-xs group"
              >
                <div className="font-semibold text-slate-200 group-hover:text-purple-400 flex items-center gap-1.5">
                  <Play className="w-3 h-3 text-purple-400" /> 5. Rate-Limit Burst Threshold
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Rapid burst of 12 requests in 2 seconds from single IP to trigger rate-limit alarm.
                </div>
              </button>
            </div>
          </div>

          {/* Telemetry Activity Log */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
                  Monitored Telemetry Activity
                </h3>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 text-cyan-300 rounded border border-slate-700">
                Telemetry Records: {eventCount}
              </span>
            </div>

            {activityLog.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">
                Authenticate or trigger an attack scenario above to generate security telemetry.
              </div>
            ) : (
              <div className="space-y-2 font-mono text-xs max-h-48 overflow-y-auto">
                {activityLog.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded bg-slate-950 border border-slate-800/80 flex items-center justify-between text-slate-300"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-cyan-400 font-bold">›</span>
                      <span className="truncate">{log.msg}</span>
                    </div>
                    <span className="text-slate-500 text-[10px] whitespace-nowrap ml-2">
                      {log.time}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Safety and Educational Simulation Footer */}
      <footer className="relative z-10 w-full px-6 py-4 border-t border-slate-800/80 bg-slate-950/70 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-cyan-500" />
          <span>Sentinel Labs Controlled Educational Simulation. No real external targets or credentials used.</span>
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          SWI-Prolog Reasoning Bridge v2.0
        </div>
      </footer>
    </div>
  );
};
