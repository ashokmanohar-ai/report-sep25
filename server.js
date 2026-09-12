const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8080);
const PUBLIC_DIR = path.join(__dirname, 'public');

const incidents = {
  'hallucination-spike': {
    name: 'Hallucination Spike', severity: 'SEV-1', domain: 'LLM Quality',
    summary: 'Groundedness drops while answer confidence remains high.',
    probableCause: 'Prompt/context regression reduced evidence anchoring and citation discipline.',
    evidence: ['Groundedness 0.93 → 0.71', 'Unsupported claims +18.4%', 'Citation coverage -21%', 'No matching API error spike'],
    blastRadius: 'High-risk for customer-facing answers and regulated workflows.',
    remediation: ['Freeze current prompt release', 'Restore previous evidence-first prompt', 'Run groundedness regression suite', 'Require citation coverage gate ≥ 0.90'],
    rollback: 'Recommended — revert prompt/config to previous known-good release.',
    decision: 'FAIL'
  },
  'rag-retrieval-degradation': {
    name: 'RAG Retrieval Degradation', severity: 'SEV-2', domain: 'RAG',
    summary: 'Retrieval relevance deteriorates even though generation latency is healthy.',
    probableCause: 'Chunking/index drift or embedding mismatch reduced retrieval precision.',
    evidence: ['Recall@5 0.91 → 0.73', 'MRR -17%', 'Context utilization -14%', 'Generation latency stable'],
    blastRadius: 'Medium-to-high impact for knowledge-intensive journeys.',
    remediation: ['Validate embedding/index versions', 'Compare top-k retrieval before/after release', 'Re-index affected corpus', 'Add golden-query retrieval gate'],
    rollback: 'Conditional — rollback index/embedding release if corpus validation fails.',
    decision: 'WARN'
  },
  'agent-tool-timeout': {
    name: 'Agent Tool Timeout', severity: 'SEV-2', domain: 'Agentic AI',
    summary: 'Agent plans correctly but stalls during downstream tool execution.',
    probableCause: 'External tool latency exceeds orchestration timeout and retry budget.',
    evidence: ['Tool P95 2.1s → 8.7s', 'Retry exhaustion 12.8%', 'Planner success 98%', 'Final task success 76%'],
    blastRadius: 'Medium impact; workflows using the affected tool fail or partially complete.',
    remediation: ['Introduce timeout budget per tool', 'Add bounded exponential retry', 'Implement fallback path', 'Expose partial-result state to users'],
    rollback: 'Not required if dependency recovers; isolate tool and degrade gracefully.',
    decision: 'WARN'
  },
  'prompt-regression': {
    name: 'Prompt Release Regression', severity: 'SEV-1', domain: 'PromptOps',
    summary: 'A prompt release improves verbosity but reduces task completion and structured output validity.',
    probableCause: 'Instruction ordering changed model behavior and weakened output constraints.',
    evidence: ['Task success 94% → 81%', 'JSON validity 99% → 87%', 'Token usage +24%', 'Latency +11%'],
    blastRadius: 'High across all flows using the shared prompt version.',
    remediation: ['Disable prompt version', 'Diff instruction ordering', 'Run golden dataset evaluation', 'Canary revised prompt before rollout'],
    rollback: 'Recommended immediately.',
    decision: 'FAIL'
  },
  'rate-limit-storm': {
    name: 'Provider Rate-Limit Storm', severity: 'SEV-1', domain: 'Runtime/API',
    summary: '429 responses surge during traffic peaks, causing retries and queue growth.',
    probableCause: 'Concurrency exceeds provider quota and retry policy amplifies load.',
    evidence: ['429 rate 0.4% → 13.2%', 'Queue depth +6.4x', 'P95 latency 1.4s → 6.9s', 'Retry traffic +31%'],
    blastRadius: 'High during peak traffic across generation-dependent journeys.',
    remediation: ['Apply concurrency limiter', 'Use jittered backoff', 'Prioritize critical traffic', 'Enable model/provider fallback'],
    rollback: 'Rollback traffic/config changes if a recent rollout increased concurrency.',
    decision: 'FAIL'
  },
  'latency-regression': {
    name: 'Latency Regression', severity: 'SEV-2', domain: 'Performance',
    summary: 'End-to-end P95 latency breaches the production SLO without corresponding error-rate growth.',
    probableCause: 'Longer contexts and extra orchestration steps increased inference and tool-chain time.',
    evidence: ['P95 1.7s → 4.8s', 'Error rate remains <1%', 'Input tokens +42%', 'Agent steps 4.1 → 6.8 avg'],
    blastRadius: 'Medium; experience degrades and timeout risk increases.',
    remediation: ['Cap retrieved context', 'Parallelize independent tool calls', 'Route simple tasks to faster path', 'Set latency budget per stage'],
    rollback: 'Conditional on SLO severity and business impact.',
    decision: 'WARN'
  }
};

function metrics() {
  const t = Date.now() / 10000;
  const wave = (min, max, shift = 0) => min + ((Math.sin(t + shift) + 1) / 2) * (max - min);
  return {
    timestamp: new Date().toISOString(),
    availability: Number(wave(99.91, 99.99, 0.2).toFixed(2)),
    taskSuccess: Number(wave(93.4, 97.8, 1.3).toFixed(1)),
    groundedness: Number(wave(0.89, 0.96, 2.1).toFixed(2)),
    p95Latency: Number(wave(1.4, 2.4, 3.2).toFixed(2)),
    errorRate: Number(wave(0.25, 0.92, 4.1).toFixed(2)),
    retrievalQuality: Number(wave(0.86, 0.94, 5.3).toFixed(2)),
    toolSuccess: Number(wave(96.1, 99.2, 6.2).toFixed(1)),
    tokenIndex: Math.round(wave(72, 89, 0.8))
  };
}

function trace() {
  return [
    { step: 1, actor: 'Planner', status: 'PASS', duration: '94 ms', detail: 'Decomposed user goal into retrieval + verification + action.' },
    { step: 2, actor: 'Retriever', status: 'PASS', duration: '187 ms', detail: 'Returned 5 ranked context chunks; relevance 0.91.' },
    { step: 3, actor: 'Tool Router', status: 'PASS', duration: '28 ms', detail: 'Selected customer-record API using policy-approved tool route.' },
    { step: 4, actor: 'External Tool', status: 'FAIL', duration: '8.7 s', detail: 'Timeout after retry budget exhausted; dependency exceeded SLO.' },
    { step: 5, actor: 'Recovery Policy', status: 'WARN', duration: '41 ms', detail: 'Fallback path used cached read-only state; write action suppressed.' },
    { step: 6, actor: 'Final Response', status: 'PASS', duration: '523 ms', detail: 'Returned partial result with transparent degradation notice.' }
  ];
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function staticFile(req, res) {
  const requestPath = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const file = path.resolve(PUBLIC_DIR, relative);
  if (!file.startsWith(PUBLIC_DIR)) return false;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300' });
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { status: 'ok', service: 'ai-reliability-command-center', version: '1.0.0', runtime: 'railway', timestamp: new Date().toISOString() });
  }
  if (req.method === 'GET' && url.pathname === '/api/metrics') return sendJson(res, 200, metrics());
  if (req.method === 'GET' && url.pathname === '/api/incidents') {
    return sendJson(res, 200, Object.entries(incidents).map(([id, x]) => ({ id, name: x.name, severity: x.severity, domain: x.domain, summary: x.summary })));
  }
  if (req.method === 'GET' && url.pathname === '/api/agent-trace') return sendJson(res, 200, { trace: trace() });
  if (req.method === 'GET' && url.pathname === '/api/architecture') {
    return sendJson(res, 200, { layers: ['Experience', 'API Gateway', 'Agent / RAG Runtime', 'Model & Tool Providers', 'Quality & Evals', 'Observability', 'Release Governance', 'Railway Runtime'] });
  }
  if (req.method === 'POST' && url.pathname === '/api/incidents/simulate') {
    try {
      const body = await readBody(req);
      const id = body.type && incidents[body.type] ? body.type : 'hallucination-spike';
      const item = incidents[id];
      const m = metrics();
      return sendJson(res, 200, {
        incidentId: `INC-${new Date().toISOString().slice(0,10).replaceAll('-', '')}-${String(Math.floor(Date.now() / 1000)).slice(-5)}`,
        generatedAt: new Date().toISOString(), environment: body.environment || 'production', traffic: body.traffic || 'Normal',
        ...item,
        healthSignals: m,
        rootCauseConfidence: id === 'agent-tool-timeout' ? 0.93 : 0.89,
        releaseGate: item.decision,
        owner: 'AI Reliability / Forward Deployed Engineering',
        nextValidation: item.decision === 'FAIL' ? 'Run targeted regression + canary before re-release.' : 'Validate remediation under synthetic load before broad rollout.'
      });
    } catch (error) { return sendJson(res, 400, { error: error.message }); }
  }
  if (req.method === 'POST' && url.pathname === '/api/release/evaluate') {
    try {
      const body = await readBody(req);
      const m = { ...metrics(), ...body };
      const failures = [];
      const warnings = [];
      if (m.taskSuccess < 90) failures.push('Task success below 90%');
      if (m.groundedness < 0.82) failures.push('Groundedness below 0.82');
      if (m.errorRate > 3) failures.push('Error rate above 3%');
      if (m.p95Latency > 4) warnings.push('P95 latency above 4s');
      if (m.retrievalQuality < 0.82) warnings.push('Retrieval quality below 0.82');
      const decision = failures.length ? 'FAIL' : warnings.length ? 'WARN' : 'PASS';
      return sendJson(res, 200, { decision, failures, warnings, evaluatedAt: new Date().toISOString(), metrics: m });
    } catch (error) { return sendJson(res, 400, { error: error.message }); }
  }

  if (req.method === 'GET' && staticFile(req, res)) return;
  if (req.method === 'GET') {
    req.url = '/index.html';
    if (staticFile(req, res)) return;
  }
  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => console.log(`AI Reliability Command Center listening on ${PORT}`));
