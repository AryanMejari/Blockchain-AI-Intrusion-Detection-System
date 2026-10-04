import React, { useState } from 'react';
import { SecurityEvent } from '../lib/api';
import { Play, Pause, Search, Filter, ShieldAlert, CheckCircle2, Clock, Globe } from 'lucide-react';

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
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-950/80 text-red-400 border border-red-800">CRITICAL</span>;
      case 'high':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-orange-950/80 text-orange-400 border border-orange-800">HIGH</span>;
      case 'medium':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-950/80 text-amber-400 border border-amber-800">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-800 text-slate-300 border border-slate-700">LOW</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'flagged') {
      return <span className="text-xs text-red-400 font-mono flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> FLAGGED</span>;
    }
    return <span className="text-xs text-slate-400 font-mono flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> MONITORED</span>;
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm flex flex-col h-full">
      {/* Stream Controls */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/50">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
            Live Telemetry Stream
          </h2>
          <span className="text-xs text-slate-400 font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
            {filtered.length} / {events.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search user, IP, detail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 text-slate-200 text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 w-44 md:w-56"
            />
          </div>

          {/* Severity filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500"
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
            className="bg-slate-950 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500"
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
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border ${
              isPaused
                ? 'bg-amber-950/60 text-amber-300 border-amber-800 hover:bg-amber-900/60'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-3 h-3 text-amber-400" /> : <Pause className="w-3 h-3 text-slate-400" />}
            {isPaused ? 'Resume Stream' : 'Pause'}
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="overflow-x-auto overflow-y-auto max-h-[480px] divide-y divide-slate-800/60">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/90 text-slate-400 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-800">
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
          <tbody className="divide-y divide-slate-800/40 text-slate-300 font-mono">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                  No telemetry matching active filters.
                </td>
              </tr>
            ) : (
              filtered.map((ev) => (
                <tr
                  key={ev.id}
                  onClick={() => onSelectEvent && onSelectEvent(ev)}
                  className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                >
                  <td className="py-2 px-3 text-cyan-400 font-semibold">{ev.id}</td>
                  <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                    {ev.timestamp ? ev.timestamp.replace('T', ' ').slice(0, 19) : '—'}
                  </td>
                  <td className="py-2 px-3">
                    <span className="font-semibold text-slate-200 bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                      {ev.type}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-100">{ev.user || '—'}</td>
                  <td className="py-2 px-3 text-slate-400 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-slate-500 inline" /> {ev.source || '127.0.0.1'}
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
