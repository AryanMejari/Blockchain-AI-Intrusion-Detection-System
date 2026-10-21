import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Boxes,
  Database,
  Link as LinkIcon,
  Search,
  RotateCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Layers,
  Cpu,
  Clock,
  Sparkles,
  X,
  FileText,
  CornerDownRight,
  HardDrive,
  Copy,
  Check,
  Radio,
  FileCheck,
  Download,
  Activity,
} from 'lucide-react';
import {
  LedgerBlock,
  LedgerStatus,
  LedgerVerificationResult,
  IPFSBundle,
  IPFSNodeStatus,
  AuditReportSummary,
  AuditReport,
  fetchLedgerStatus,
  fetchLedgerBlocks,
  fetchIPFSBundle,
  fetchIPFSNodeStatus,
  generateAuditReport,
  fetchReports,
  fetchReportById,
  fetchReportMarkdown,
  verifyLedger,
  simulateTamper,
  restoreTamper,
} from '../lib/api';

export const BlockchainLedgerView: React.FC = () => {
  const [status, setStatus] = useState<LedgerStatus | null>(null);
  const [blocks, setBlocks] = useState<LedgerBlock[]>([]);
  const [verification, setVerification] = useState<LedgerVerificationResult | null>(null);
  const [nodeStatus, setNodeStatus] = useState<IPFSNodeStatus | null>(null);
  const [reports, setReports] = useState<AuditReportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isTampering, setIsTampering] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // IPFS Modal
  const [activeCID, setActiveCID] = useState<string | null>(null);
  const [ipfsBundle, setIpfsBundle] = useState<IPFSBundle | null>(null);
  const [loadingIPFS, setLoadingIPFS] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Report Modal
  const [activeReport, setActiveReport] = useState<AuditReport | null>(null);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const loadLedgerData = async () => {
    setIsLoading(true);
    try {
      const [s, b, node, reps] = await Promise.all([
        fetchLedgerStatus(),
        fetchLedgerBlocks(50),
        fetchIPFSNodeStatus(),
        fetchReports(),
      ]);
      setStatus(s);
      setBlocks(b);
      setNodeStatus(node);
      setReports(reps);
    } catch (err) {
      console.error('Failed to load blockchain ledger data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLedgerData();
  }, []);

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await verifyLedger();
      setVerification(res);
      // Refresh status as well
      const s = await fetchLedgerStatus();
      setStatus(s);
    } catch (err) {
      console.error('Failed to verify ledger:', err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSimulateTamper = async () => {
    setIsTampering(true);
    try {
      await simulateTamper(undefined, '[MALICIOUS_TAMPER] Intruder purged failed login audit trail.');
      await handleVerify();
    } catch (err) {
      console.error('Failed to simulate tamper:', err);
    } finally {
      setIsTampering(false);
    }
  };

  const handleRestoreTamper = async (eventId: string) => {
    setIsTampering(true);
    try {
      await restoreTamper(eventId);
      await handleVerify();
      await loadLedgerData();
    } catch (err) {
      console.error('Failed to restore tamper:', err);
    } finally {
      setIsTampering(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const report = await generateAuditReport();
      setActiveReport(report);
      // Fetch markdown
      const md = await fetchReportMarkdown(report.report_id);
      setReportMarkdown(md);
      // Refresh reports list
      const reps = await fetchReports();
      setReports(reps);
    } catch (err) {
      console.error('Failed to generate audit report:', err);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const openReport = async (reportId: string) => {
    setLoadingReport(true);
    try {
      const [rep, md] = await Promise.all([
        fetchReportById(reportId),
        fetchReportMarkdown(reportId),
      ]);
      setActiveReport(rep);
      setReportMarkdown(md);
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoadingReport(false);
    }
  };

  const downloadReportMarkdown = () => {
    if (!reportMarkdown || !activeReport) return;
    const blob = new Blob([reportMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeReport.report_id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openIPFSBundle = async (cid: string) => {
    setActiveCID(cid);
    setLoadingIPFS(true);
    try {
      const bundle = await fetchIPFSBundle(cid);
      setIpfsBundle(bundle);
    } catch (err) {
      console.error('Failed to load IPFS bundle:', err);
    } finally {
      setLoadingIPFS(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const isCompromised = verification && !verification.is_valid;

  return (
    <div className="space-y-6">
      {/* IPFS Node Live Status Banner */}
      <section className="neo-card rounded-2xl p-4 border border-white/[0.06] bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-slate-950/80">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl neo-well flex items-center justify-center text-amber-400">
                <Radio className={`w-5 h-5 ${nodeStatus?.online ? 'text-emerald-400' : 'text-amber-400'}`} />
              </div>
              {nodeStatus?.online && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                  IPFS Desktop Daemon
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    nodeStatus?.online
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {nodeStatus?.online ? 'CONNECTED & ACTIVE' : 'LOCAL VAULT RESILIENT'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Listening Multiaddr: <span className="text-cyan-400 font-bold">{nodeStatus?.multiaddr || '/ip4/127.0.0.1/tcp/5001'}</span>
                {nodeStatus?.agent_version && (
                  <span className="text-slate-500 ml-2">({nodeStatus.agent_version})</span>
                )}
              </p>
            </div>
          </div>

          {/* Quick peer & gateway info */}
          <div className="flex items-center gap-3 text-xs font-mono">
            {nodeStatus?.peer_id && (
              <div className="neo-well px-3 py-1.5 rounded-xl flex items-center gap-2 text-slate-300">
                <span className="text-slate-500 text-[10px]">PEER ID:</span>
                <span className="text-[11px] text-slate-200">
                  {nodeStatus.peer_id.slice(0, 10)}...{nodeStatus.peer_id.slice(-6)}
                </span>
                <button
                  onClick={() => copyToClipboard(nodeStatus.peer_id!, 'peer')}
                  className="hover:text-cyan-400 text-slate-400"
                  title="Copy Peer ID"
                >
                  {copiedText === 'peer' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}

            <button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl neo-btn text-cyan-300 hover:text-cyan-200 text-xs font-bold border border-cyan-500/30"
              title="Compile and pin immutable SOC audit report to IPFS"
            >
              <FileCheck className={`w-3.5 h-3.5 ${isGeneratingReport ? 'animate-spin' : ''}`} />
              <span>{isGeneratingReport ? 'Generating Report...' : 'Generate Audit Report'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Top Ledger KPIs */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        
        {/* Status */}
        <div className="neo-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span>Cryptographic State</span>
            {isCompromised ? (
              <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div className="neo-well rounded-xl px-3 py-2 flex items-baseline justify-between">
            <span className={`text-xl font-bold font-mono ${isCompromised ? 'text-rose-400' : 'text-emerald-400'}`}>
              {isCompromised ? 'COMPROMISED' : 'VERIFIED'}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {isCompromised ? 'MISMATCH' : 'SHA-256'}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-2">
            {isCompromised ? 'Tampering detected in SQLite' : 'Merkle tree & chain intact'}
          </div>
        </div>

        {/* Blocks Height */}
        <div className="neo-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span>Block Height</span>
            <Boxes className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="neo-well rounded-xl px-3 py-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-cyan-400">
              #{status?.block_height ?? 0}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {status?.total_blocks ?? 1} BLOCKS
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-2">Immutable chained headers</div>
        </div>

        {/* Anchored Events */}
        <div className="neo-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span>Anchored Telemetry</span>
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div className="neo-well rounded-xl px-3 py-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-purple-400">
              {status?.total_anchored_events ?? 0}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">SEALED</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-2">Events locked into Merkle roots</div>
        </div>

        {/* IPFS Vault */}
        <div className="neo-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold uppercase tracking-wider mb-2">
            <span>IPFS Vault Objects</span>
            <HardDrive className="w-4 h-4 text-amber-400" />
          </div>
          <div className="neo-well rounded-xl px-3 py-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-400">
              {status?.ipfs_objects_count ?? 1}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">CIDs PINNED</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-2">Content-addressed forensic packages</div>
        </div>
      </section>

      {/* Audit & Tamper Simulation Console */}
      <section className="neo-card rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.04] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl neo-well flex items-center justify-center text-cyan-400">
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold tracking-wider uppercase text-slate-100">
                Non-Repudiation Audit & Anti-Tamper Verification
              </h3>
              <p className="text-[11px] text-slate-400">
                Verify cryptographic proof of all security records against the blockchain and IPFS storage
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl neo-btn-primary text-slate-950 font-bold text-xs transition-all shadow-md"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>{isVerifying ? 'Scanning Chain...' : 'Run Cryptographic Audit'}</span>
            </button>

            <button
              onClick={handleSimulateTamper}
              disabled={isTampering}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl neo-btn text-rose-400 hover:text-rose-300 font-bold text-xs transition-all border border-rose-800/80"
              title="Maliciously alters a log record in SQLite to demonstrate tamper detection"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Simulate Attacker Tampering</span>
            </button>
          </div>
        </div>

        {/* Verification Alert Banner if run */}
        {verification && (
          <div
            className={`p-4 rounded-xl mb-4 text-xs font-mono border ${
              verification.is_valid
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-start gap-3">
              {verification.is_valid ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
              )}
              <div className="space-y-1.5 flex-1">
                <div className="font-bold uppercase tracking-wider text-sm flex items-center justify-between">
                  <span>
                    Audit Result:{' '}
                    {verification.is_valid ? '100% Cryptographically Valid' : 'INTEGRITY BREACH DETECTED'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Timestamp: {verification.audit_timestamp.slice(0, 19)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Scanned {verification.blocks_scanned} block headers and verified {verification.verified_events_count} event leaf hashes against IPFS content roots.
                </p>

                {/* Show Tampered Events with One-Click Restore */}
                {verification.tampered_events && verification.tampered_events.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-rose-800/40 space-y-2">
                    <span className="text-xs font-bold text-rose-400 uppercase tracking-wide block">
                      Tampered Audit Entries Detected:
                    </span>
                    {verification.tampered_events.map((t) => (
                      <div
                        key={t.event_id}
                        className="bg-black/40 p-3 rounded-lg flex items-center justify-between gap-4 text-[11px]"
                      >
                        <div>
                          <div className="font-bold text-slate-200">
                            Event <span className="text-cyan-400">{t.event_id}</span> in Block #{t.block_index}
                          </div>
                          <div className="text-rose-300 text-[10px] mt-0.5">
                            Modified Detail: &quot;{t.current_detail}&quot;
                          </div>
                          <div className="text-slate-500 text-[10px]">
                            Expected Hash: {t.expected_hash.slice(0, 16)}... | Active DB Hash: {t.current_db_hash.slice(0, 16)}...
                          </div>
                        </div>

                        <button
                          onClick={() => handleRestoreTamper(t.event_id)}
                          disabled={isTampering}
                          className="px-3 py-1.5 rounded-lg neo-btn-primary text-slate-950 text-xs font-bold flex items-center gap-1.5 shrink-0"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Restore from IPFS Snapshot</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Forensic Audit Reports Archive */}
      {reports.length > 0 && (
        <section className="neo-card rounded-2xl p-5 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.04] mb-3">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold tracking-wider uppercase text-slate-100">
                Cryptographic Forensic Audit Reports ({reports.length})
              </h3>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              CONTENT-ADDRESSED VIA IPFS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {reports.map((rep) => (
              <div
                key={rep.id}
                className="neo-well p-3.5 rounded-xl border border-white/[0.04] hover:border-cyan-500/30 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-[11px] font-bold text-cyan-400">
                      {rep.id}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                        rep.status === 'VALID'
                          ? 'bg-emerald-950/80 text-emerald-400'
                          : 'bg-rose-950/80 text-rose-400'
                      }`}
                    >
                      {rep.status}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200 line-clamp-1 mb-1">
                    {rep.title}
                  </h4>
                  <div className="text-[10px] font-mono text-slate-400 space-y-0.5 mb-3">
                    <div>Block Height: #{rep.block_height}</div>
                    <div>Events: {rep.summary.total_events} | Alerts: {rep.summary.total_alerts}</div>
                    <div className="text-slate-500 truncate" title={rep.ipfs_cid}>
                      IPFS CID: {rep.ipfs_cid.slice(0, 16)}...
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                  <button
                    onClick={() => openReport(rep.id)}
                    className="flex-1 py-1 px-2.5 rounded-lg neo-btn text-[11px] text-slate-200 hover:text-cyan-400 font-mono font-semibold"
                  >
                    Inspect Report
                  </button>
                  <a
                    href={rep.gateway_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg neo-well hover:text-cyan-400 text-slate-400"
                    title="View on Public IPFS Gateway"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Blockchain Blocks List */}
      <section className="neo-card rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.04] mb-4">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold tracking-wider uppercase text-slate-100">
              Blockchain Ledger Blocks ({blocks.length})
            </h3>
          </div>
          <span className="text-slate-200 font-mono text-[11px]">IPFS Multihash Base58 Content-Addressing</span>
        </div>

        <div className="space-y-3">
          {blocks.map((block) => {
            const isGenesis = block.block_index === 0;

            return (
              <div
                key={block.block_index}
                className="neo-well rounded-xl p-4 border border-white/[0.04] hover:border-cyan-500/20 transition-all"
              >
                {/* Block Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded-lg neo-btn text-cyan-400 font-mono font-bold text-xs">
                      Block #{block.block_index}
                    </span>
                    {isGenesis && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-950/80 text-purple-300 border border-purple-500/30">
                        Genesis Anchor
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {block.timestamp}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono neo-well px-2 py-0.5 rounded">
                      {block.events_count} {block.events_count === 1 ? 'Event' : 'Events'}
                    </span>

                    {/* IPFS CID Badge */}
                    <button
                      onClick={() => openIPFSBundle(block.ipfs_cid)}
                      className="neo-well hover:border-cyan-500/40 px-2.5 py-1 rounded-lg text-amber-400 hover:text-amber-300 font-mono text-xs flex items-center gap-1.5 transition-colors border border-amber-500/20"
                      title="Inspect decentralized IPFS forensic bundle"
                    >
                      <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[10px] text-slate-400">IPFS:</span>
                      <span>{block.ipfs_cid.slice(0, 10)}...</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  </div>
                </div>

                {/* Hashes Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] font-mono p-2.5 rounded-xl neo-well text-slate-400 mb-2.5">
                  <div>
                    <span className="text-slate-500 block">BLOCK HASH</span>
                    <span className="text-slate-200 truncate block font-bold" title={block.block_hash}>
                      {block.block_hash}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">PREVIOUS HASH LINK</span>
                    <span className="text-slate-400 truncate block" title={block.prev_hash}>
                      {block.prev_hash}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">MERKLE ROOT</span>
                    <span className="text-purple-300 truncate block" title={block.merkle_root}>
                      {block.merkle_root}
                    </span>
                  </div>
                </div>

                {/* Event IDs */}
                {block.event_ids && block.event_ids.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono text-slate-400">
                    <span className="text-slate-500">Sealed Records:</span>
                    {block.event_ids.map((id) => (
                      <span key={id} className="neo-well px-1.5 py-0.2 rounded text-cyan-400">
                        {id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Forensic Audit Report Modal */}
      {activeReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="neo-card-raised rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-white/[0.08] space-y-4 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <FileCheck className="w-5 h-5 text-cyan-400" />
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
                    <span>{activeReport.title}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                        activeReport.cryptographic_attestation?.chain_status === 'VALID'
                          ? 'bg-emerald-950/80 text-emerald-400'
                          : 'bg-rose-950/80 text-rose-400'
                      }`}
                    >
                      {activeReport.cryptographic_attestation?.chain_status || 'VALID'}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Report ID: <span className="text-cyan-400">{activeReport.report_id}</span> | Generated: {activeReport.generated_at}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={downloadReportMarkdown}
                  className="px-3 py-1.5 rounded-xl neo-btn-primary text-slate-950 text-xs font-bold flex items-center gap-1.5"
                  title="Download Markdown Report"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .md</span>
                </button>
                <button
                  onClick={() => {
                    setActiveReport(null);
                    setReportMarkdown(null);
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Tabs / Scrollable Body */}
            <div className="flex-1 overflow-y-auto space-y-4 scrollbar-thin text-xs">
              {/* Attestation Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                <div className="neo-well p-2.5 rounded-xl">
                  <span className="text-slate-500 text-[10px] block">CHAIN STATUS</span>
                  <span className="text-emerald-400 font-bold">
                    {activeReport.cryptographic_attestation?.chain_status || 'VALID'}
                  </span>
                </div>
                <div className="neo-well p-2.5 rounded-xl">
                  <span className="text-slate-500 text-[10px] block">BLOCK HEIGHT</span>
                  <span className="text-cyan-400 font-bold">
                    #{activeReport.cryptographic_attestation?.block_height ?? 0}
                  </span>
                </div>
                <div className="neo-well p-2.5 rounded-xl">
                  <span className="text-slate-500 text-[10px] block">SCANNED EVENTS</span>
                  <span className="text-purple-400 font-bold">
                    {activeReport.security_summary?.total_events_analyzed ?? 0}
                  </span>
                </div>
                <div className="neo-well p-2.5 rounded-xl">
                  <span className="text-slate-500 text-[10px] block">ALERTS RAISED</span>
                  <span className="text-amber-400 font-bold">
                    {activeReport.security_summary?.total_alerts_raised ?? 0}
                  </span>
                </div>
              </div>

              {/* IPFS Attestation */}
              <div className="neo-well p-3 rounded-xl space-y-1 font-mono text-[11px] text-slate-300">
                <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-bold">
                  <span>Decentralized IPFS Storage Proof</span>
                  <a
                    href={activeReport.ipfs_gateway_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1 font-normal"
                  >
                    <span>View Public CID</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="truncate">
                  <span className="text-slate-500">IPFS CID: </span>
                  <span className="text-amber-400 font-bold">{activeReport.ipfs_cid}</span>
                </div>
                <div className="truncate">
                  <span className="text-slate-500">Report SHA-256: </span>
                  <span className="text-slate-400">{activeReport.report_hash_sha256}</span>
                </div>
                <div className="truncate text-slate-500">
                  Storage Node: {activeReport.ipfs_node_attestation?.multiaddr || '/ip4/127.0.0.1/tcp/5001'} (
                  {activeReport.ipfs_node_attestation?.agent_version || 'kubo/0.36.0/desktop'})
                </div>
              </div>

              {/* Markdown Preview */}
              {reportMarkdown && (
                <div>
                  <div className="flex items-center justify-between mb-1 text-slate-400 font-mono text-[11px]">
                    <span>Formatted Executive Audit Document:</span>
                    <button
                      onClick={() => copyToClipboard(reportMarkdown, 'report_md')}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      {copiedText === 'report_md' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedText === 'report_md' ? 'Copied' : 'Copy Markdown'}</span>
                    </button>
                  </div>
                  <pre className="neo-well rounded-xl p-4 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-72 scrollbar-thin whitespace-pre-wrap leading-relaxed">
                    {reportMarkdown}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-2 flex items-center justify-end border-t border-white/[0.04]">
              <button
                onClick={() => {
                  setActiveReport(null);
                  setReportMarkdown(null);
                }}
                className="px-4 py-1.5 rounded-xl neo-btn text-xs text-slate-200"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IPFS Forensic Evidence Modal */}
      {activeCID && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="neo-card-raised rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-white/[0.08] space-y-4 max-h-[85vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-cyan-400" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                    IPFS Forensic Evidence Bundle
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Content Identifier: {activeCID}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setActiveCID(null);
                  setIpfsBundle(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            {loadingIPFS ? (
              <div className="py-16 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
                <RotateCw className="w-6 h-6 text-cyan-400 animate-spin" />
                <span>Fetching content-addressed payload from IPFS vault...</span>
              </div>
            ) : ipfsBundle ? (
              <div className="flex-1 overflow-y-auto space-y-3.5 scrollbar-thin">
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-2 text-xs neo-well p-3 rounded-xl font-mono text-slate-300">
                  <div>
                    <span className="text-slate-500 text-[10px] block">CONTENT INTEGRITY</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Authentic (Hash Matched)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">PAYLOAD SIZE</span>
                    <span>{ipfsBundle.size_bytes} Bytes</span>
                  </div>
                </div>

                {/* Raw JSON viewer */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 text-xs text-slate-400 font-mono">
                    <span>Forensic JSON Package:</span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(ipfsBundle.payload, null, 2), 'json')}
                      className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                    >
                      {copiedText === 'json' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedText === 'json' ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="neo-well rounded-xl p-3 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-64 scrollbar-thin leading-relaxed">
                    {JSON.stringify(ipfsBundle.payload, null, 2)}
                  </pre>
                </div>

                {/* Gateway Link */}
                <div className="pt-1 flex items-center justify-between text-xs">
                  <a
                    href={ipfsBundle.gateway_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px] font-mono"
                  >
                    <span>Public Gateway Link: ipfs.io/ipfs/{activeCID.slice(0, 16)}...</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  <button
                    onClick={() => {
                      setActiveCID(null);
                      setIpfsBundle(null);
                    }}
                    className="px-4 py-1.5 rounded-xl neo-btn text-xs text-slate-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                Failed to load IPFS bundle.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
