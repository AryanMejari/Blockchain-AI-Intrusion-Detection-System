export interface SecurityEvent {
  id: string;
  type: string;
  timestamp: string;
  user: string;
  source: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  detection_status: string;
  investigation_id?: string;
  detail: string;
  count?: number;
  context?: string;
  resource?: string;
  process?: string;
}

export interface RecommendedAction {
  id: string;
  title: string;
  reason: string;
  priority: number;
  mode: string;
  target?: string;
}

export interface SecurityAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  risk_score: number;
  title: string;
  subject: string;
  confidence: string;
  summary: string;
  evidence_ids: string[];
  evidence_count: number;
  rationale: string[];
  rule: string;
  status: 'new' | 'investigating' | 'resolved' | 'false_positive';
  observed_facts: string[];
  inferred_facts: string[];
  missing_evidence: string[];
  alternative_explanations: string[];
  recommended_action: RecommendedAction;
  created_at: string;
  updated_at: string;
}

export interface Metrics {
  total_events: number;
  failed_logins: number;
  active_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  medium_alerts: number;
  low_alerts: number;
  suspicious_accounts: number;
  investigations_in_progress: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'alert' | 'subject' | 'event' | 'source' | 'user' | 'evidence';
  severity?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export interface InvestigationData {
  timeline: SecurityEvent[];
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}

export interface LedgerBlock {
  block_index: number;
  timestamp: string;
  merkle_root: string;
  ipfs_cid: string;
  prev_hash: string;
  block_hash: string;
  event_ids: string[];
  events_count: number;
  nonce?: number;
}

export interface LedgerStatus {
  chain_valid: boolean;
  block_height: number;
  total_blocks: number;
  total_anchored_events: number;
  latest_block_hash: string;
  latest_merkle_root: string;
  latest_ipfs_cid: string;
  ipfs_objects_count: number;
}

export interface IPFSBundle {
  cid: string;
  is_authentic: boolean;
  computed_cid: string;
  payload: any;
  size_bytes: number;
  gateway_url: string;
}

export interface TamperedEventInfo {
  event_id: string;
  block_index: number;
  expected_hash: string;
  current_db_hash: string;
  current_detail: string;
  user: string;
  source: string;
}

export interface LedgerVerificationResult {
  status: 'VALID' | 'COMPROMISED';
  is_valid: boolean;
  blocks_scanned: number;
  verified_events_count: number;
  chain_errors: Array<{ block_index: number; error: string }>;
  tampered_events: TamperedEventInfo[];
  audit_timestamp: string;
}

export interface IPFSNodeStatus {
  online: boolean;
  multiaddr: string;
  rpc_url: string;
  peer_id?: string;
  agent_version?: string;
  version?: string;
  golang?: string;
  addresses_count?: number;
  local_gateway?: string;
  public_gateway?: string;
  error?: string;
}

export interface AuditReportSummary {
  id: string;
  title: string;
  created_at: string;
  ipfs_cid: string;
  block_height: number;
  status: 'VALID' | 'COMPROMISED';
  summary: {
    report_id: string;
    title: string;
    generated_at: string;
    status: string;
    block_height: number;
    total_events: number;
    total_alerts: number;
    critical_alerts: number;
    high_alerts: number;
    ipfs_cid: string;
    report_hash: string;
  };
  gateway_url: string;
}

export interface AuditReport {
  report_id: string;
  title: string;
  generated_at: string;
  auditor: string;
  cryptographic_attestation: any;
  ipfs_node_attestation: any;
  security_summary: any;
  alerts: any[];
  recent_blocks: any[];
  report_hash_sha256: string;
  ipfs_cid: string;
  ipfs_gateway_url: string;
  pinned_to_node?: boolean;
}

const BASE_URL = '';

export async function fetchIPFSNodeStatus(): Promise<IPFSNodeStatus> {
  const res = await fetch(`${BASE_URL}/api/ipfs/node-status`);
  return res.json();
}

export async function generateAuditReport(title?: string): Promise<AuditReport> {
  const res = await fetch(`${BASE_URL}/api/reports/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return res.json();
}

export async function fetchReports(): Promise<AuditReportSummary[]> {
  const res = await fetch(`${BASE_URL}/api/reports`);
  return res.json();
}

export async function fetchReportById(reportId: string): Promise<AuditReport> {
  const res = await fetch(`${BASE_URL}/api/reports/${encodeURIComponent(reportId)}`);
  return res.json();
}

export async function fetchReportMarkdown(reportId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/reports/${encodeURIComponent(reportId)}/markdown`);
  const data = await res.json();
  return data.markdown;
}

export async function fetchLedgerStatus(): Promise<LedgerStatus> {
  const res = await fetch(`${BASE_URL}/api/ledger/status`);
  return res.json();
}

export async function fetchLedgerBlocks(limit: number = 50): Promise<LedgerBlock[]> {
  const res = await fetch(`${BASE_URL}/api/ledger/blocks?limit=${limit}`);
  return res.json();
}

export async function fetchIPFSBundle(cid: string): Promise<IPFSBundle> {
  const res = await fetch(`${BASE_URL}/api/ipfs/${encodeURIComponent(cid)}`);
  return res.json();
}

export async function verifyLedger(): Promise<LedgerVerificationResult> {
  const res = await fetch(`${BASE_URL}/api/ledger/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function simulateTamper(event_id?: string, detail?: string) {
  const res = await fetch(`${BASE_URL}/api/ledger/simulate-tamper`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id, detail }),
  });
  return res.json();
}

export async function restoreTamper(event_id: string) {
  const res = await fetch(`${BASE_URL}/api/ledger/restore-tamper`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id }),
  });
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch(`${BASE_URL}/api/health`);
  return res.json();
}

export async function login(
  username: string,
  password: string,
  simulated_source: string = '192.168.1.100',
  simulated_context: string = 'usual'
) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, simulated_source, simulated_context }),
  });
  return res.json();
}

export async function resetSystemTelemetry() {
  const res = await fetch(`${BASE_URL}/api/system/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error('Failed to reset system telemetry');
  }
  return res.json();
}

export async function ingestEvent(event: Partial<SecurityEvent>) {
  const res = await fetch(`${BASE_URL}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    throw new Error('Failed to ingest security event');
  }
  return res.json();
}

export async function runScenario(scenario_id: string, target_user?: string, source_ip?: string) {
  const res = await fetch(`${BASE_URL}/api/lab/scenarios/${scenario_id}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario_id, target_user, source_ip }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Scenario failed' }));
    throw new Error(err.detail || 'Scenario execution failed');
  }
  return res.json();
}

export async function fetchEvents(params?: {
  limit?: number;
  offset?: number;
  severity?: string;
  type?: string;
  search?: string;
}) {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());
  if (params?.severity) query.set('severity', params.severity);
  if (params?.type) query.set('type', params.type);
  if (params?.search) query.set('search', params.search);

  const res = await fetch(`${BASE_URL}/api/events?${query.toString()}`);
  return res.json();
}

export async function fetchAlerts(): Promise<SecurityAlert[]> {
  const res = await fetch(`${BASE_URL}/api/alerts`);
  return res.json();
}

export async function fetchAlert(alert_id: string): Promise<SecurityAlert> {
  const res = await fetch(`${BASE_URL}/api/alerts/${encodeURIComponent(alert_id)}`);
  return res.json();
}

export async function updateAlertStatus(
  alert_id: string,
  status: 'new' | 'investigating' | 'resolved' | 'false_positive'
): Promise<SecurityAlert> {
  const res = await fetch(`${BASE_URL}/api/alerts/${encodeURIComponent(alert_id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return res.json();
}

export async function fetchMetrics(): Promise<Metrics> {
  const res = await fetch(`${BASE_URL}/api/metrics`);
  return res.json();
}

export async function fetchInvestigation(investigation_id: string): Promise<InvestigationData> {
  const res = await fetch(`${BASE_URL}/api/investigations/${encodeURIComponent(investigation_id)}`);
  const data = await res.json();
  return data.data;
}

export async function fetchExplanation(investigation_id: string) {
  const res = await fetch(`${BASE_URL}/api/investigations/${encodeURIComponent(investigation_id)}/explanation`);
  return res.json();
}

export function createDashboardWebSocket(
  onMessage: (data: any) => void,
  onOpen?: () => void,
  onClose?: () => void
) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}/ws/dashboard`;

  let ws: WebSocket | null = null;
  let reconnectTimer: any = null;

  function connect() {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (onOpen) onOpen();
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          onMessage(parsed);
        } catch (e) {
          console.warn('WS non-json frame:', event.data);
        }
      };

      ws.onclose = () => {
        if (onClose) onClose();
        // Auto-reconnect after 3 seconds
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch (e) {
      reconnectTimer = setTimeout(connect, 3000);
    }
  }

  connect();

  return {
    disconnect: () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    },
  };
}
