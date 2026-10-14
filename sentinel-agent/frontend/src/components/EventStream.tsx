import React, { useState } from 'react';
import { SecurityEvent } from '../lib/api';
import { Play, Pause, Search, Filter, ShieldAlert, CheckCircle2, Clock, Globe, Activity } from 'lucide-react';

interface EventStreamProps {
  events: SecurityEvent[];
  isPaused: boolean;
  onTogglePause: () => void;
  onSelectEvent?: (event: SecurityEvent) => void;
}

export const EventStream: React.FC<EventStreamProps> = ({
  events,
  isPaused,
  onTogglePause,
  onSelectEvent,
}) => {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = events.filter((e) => {
    if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        e.id.toLowerCase().includes(q) ||
        e.user.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-950/80 text-rose-400 border border-rose-800 neo-pill">CRITICAL</span>;
      case 'high':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-950/80 text-orange-400 border border-orange-800 neo-pill">HIGH</span>;
      case 'medium':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-950/80 text-amber-400 border border-amber-800 neo-pill">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-800/80 text-slate-300 border border-slate-700 neo-pill">LOW</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'flagged') {
      return <span className="text-[11px] text-rose-400 font-mono flex items-center gap-1 font-bold"><ShieldAlert className="w-3.5 h-3.5" /> FLAGGED</span>;
    }
    return <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> MONITORED</span>;
  };

  return (
    <div className="neo-card rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full">
      {/* Stream Controls */}
      <div className="p-4 border-b border-white/[0.04] flex flex-wrap items-center justify-between gap-3 bg-[#0d121f]/60">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <h2 className="text-xs font-bold tracking-wider uppercase text-slate-200">
            Live Telemetry Stream
          </h2>
          <span className="text-[10px] text-slate-400 font-mono neo-well px-2.5 py-0.5 rounded-full">
            {filtered.length} / {events.length} Records
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search user, IP, detail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="neo-well text-slate-200 text-xs pl-8 pr-3 py-1.5 rounded-xl focus:outline-none focus:border-cyan-500 w-44 md:w-56"
            />
          </div>

          {/* Severity filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="neo-well text-slate-300 text-xs px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="neo-well text-slate-300 text-xs px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Types</option>
            <option value="failed_login">failed_login</option>
            <option value="successful_login">successful_login</option>
            <option value="account_lockout">account_lockout</option>
            <option value="sensitive_access">sensitive_access</option>
            <option value="privilege_change">privilege_change</option>
            <option value="unusual_process">unusual_process</option>
            <option value="rate_limit_event">rate_limit_event</option>
          </select>

          {/* Pause / Resume */}
          <button
            onClick={onTogglePause}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all neo-btn ${
              isPaused
                ? 'text-amber-400 border border-amber-800/80'
                : 'text-slate-300'
            }`}
          >
            {isPaused ? <Play className="w-3 h-3 text-amber-400 fill-amber-400" /> : <Pause className="w-3 h-3 text-slate-400" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="overflow-x-auto overflow-y-auto flex-1 divide-y divide-white/[0.03] scrollbar-thin">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0b0f1a] text-slate-400 uppercase tracking-wider sticky top-0 z-10 border-b border-white/[0.04]">
            <tr>
              <th className="py-2.5 px-3">Event ID</th>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">User / Target</th>
              <th className="py-2.5 px-3">Source IP</th>
              <th className="py-2.5 px-3">Severity</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02] text-slate-300 font-mono">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-14 text-center text-slate-500 font-sans">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Activity className="w-7 h-7 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-300">Telemetry Stream Ready</p>
                    <p className="text-xs text-slate-500">
                      No security telemetry recorded yet. Authenticate or run an attack scenario on the Login Page.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((ev) => (
                <tr
                  key={ev.id}
                  onClick={() => onSelectEvent && onSelectEvent(ev)}
                  className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                >
                  <td className="py-2 px-3 text-cyan-400 font-semibold">{ev.id}</td>
                  <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                    {ev.timestamp ? ev.timestamp.replace('T', ' ').slice(0, 19) : '—'}
                  </td>
                  <td className="py-2 px-3">
                    <span className="font-semibold text-slate-200 neo-well px-2 py-0.5 rounded text-[10px]">
                      {ev.type}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-100">{ev.user || '—'}</td>
                  <td className="py-2 px-3 text-slate-400">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3 text-slate-500 inline" /> {ev.source || '127.0.0.1'}
                    </span>
                  </td>
                  <td className="py-2 px-3">{getSeverityBadge(ev.severity)}</td>
                  <td className="py-2 px-3">{getStatusBadge(ev.detection_status)}</td>
                  <td className="py-2 px-3 text-slate-300 max-w-xs truncate font-sans text-xs" title={ev.detail}>
                    {ev.detail || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
