let selectedIncident='hallucination-spike';
const $=id=>document.getElementById(id);
const escapeHtml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const list=items=>`<ul>${(items||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`;

async function refreshMetrics(){
  try{
    const r=await fetch('/api/metrics',{cache:'no-store'}); const m=await r.json();
    $('availability').textContent=`${m.availability}%`;
    $('taskSuccess').textContent=`${m.taskSuccess}%`;
    $('groundedness').textContent=m.groundedness;
    $('p95Latency').textContent=`${m.p95Latency}s`;
    $('errorRate').textContent=`${m.errorRate}%`;
    $('retrievalQuality').textContent=m.retrievalQuality;
    $('toolSuccess').textContent=`${m.toolSuccess}%`;
    $('tokenIndex').textContent=m.tokenIndex;
  }catch{}
}

document.querySelectorAll('.scenario').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.scenario').forEach(x=>x.classList.remove('active'));
  btn.classList.add('active'); selectedIncident=btn.dataset.type;
}));

$('simulateBtn').addEventListener('click',async()=>{
  const target=$('analysis');
  target.className='analysis empty';
  target.innerHTML='<div class="analysis-icon">◌</div><h3>Correlating production signals…</h3><p>Inspecting quality, retrieval, tool, latency and runtime evidence.</p>';
  try{
    const r=await fetch('/api/incidents/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:selectedIncident,environment:$('environment').value,traffic:$('traffic').value})});
    if(!r.ok)throw new Error('Incident analysis failed'); const d=await r.json();
    target.className='analysis';
    target.innerHTML=`<div class="rca-head"><div><div class="rca-id">${escapeHtml(d.incidentId)} · ${escapeHtml(d.environment)} · ${escapeHtml(d.traffic)}</div><h3>${escapeHtml(d.name)}</h3><small>${escapeHtml(d.severity)} · ${escapeHtml(d.domain)}</small></div><span class="decision ${escapeHtml(d.releaseGate)}">${escapeHtml(d.releaseGate)} RELEASE</span></div>
      <div class="rca-section"><h4>What happened</h4><p>${escapeHtml(d.summary)}</p></div>
      <div class="rca-section"><h4>Probable root cause</h4><p>${escapeHtml(d.probableCause)}</p><div class="confidence"><span>Root-cause confidence</span><b>${Math.round(d.rootCauseConfidence*100)}%</b></div><div class="confidence-bar"><span style="width:${Math.round(d.rootCauseConfidence*100)}%"></span></div></div>
      <div class="rca-section"><h4>Evidence</h4>${list(d.evidence)}</div>
      <div class="rca-section"><h4>Blast radius</h4><p>${escapeHtml(d.blastRadius)}</p></div>
      <div class="rca-section"><h4>Immediate remediation</h4>${list(d.remediation)}</div>
      <div class="rca-section"><h4>Rollback decision</h4><p>${escapeHtml(d.rollback)}</p><p><b>Next validation:</b> ${escapeHtml(d.nextValidation)}</p></div>`;
  }catch(e){target.className='analysis empty';target.innerHTML=`<h3>Analysis unavailable</h3><p>${escapeHtml(e.message)}</p>`;}
});

async function loadTrace(){
  try{const r=await fetch('/api/agent-trace');const d=await r.json();$('traceList').innerHTML=d.trace.map(x=>`<div class="trace-row"><div class="trace-num">${x.step}</div><div class="trace-actor"><b>${escapeHtml(x.actor)}</b><small>${escapeHtml(x.duration)}</small></div><div class="trace-status ${escapeHtml(x.status)}">${escapeHtml(x.status)}</div><div class="trace-detail">${escapeHtml(x.detail)}</div></div>`).join('');}catch{$('traceList').textContent='Trace unavailable';}
}

$('evaluateBtn').addEventListener('click',async()=>{
  const out=$('releaseDecision'); out.textContent='Evaluating current production signals…';
  try{const r=await fetch('/api/release/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const d=await r.json();const detail=[...(d.failures||[]),...(d.warnings||[])];out.innerHTML=`<b>${escapeHtml(d.decision)}</b> — ${detail.length?escapeHtml(detail.join(' · ')):'All live quality and runtime gates are within configured thresholds.'}`;}catch{out.textContent='Release evaluation unavailable.';}
});

refreshMetrics(); loadTrace(); setInterval(refreshMetrics,7000);
