# AI Reliability Command Center — Railway Edition

A recruiter-facing production AI reliability studio by **Ashok Kumar Manohar**.

The application demonstrates how Forward Deployed AI Engineering and AI Quality Engineering come together after deployment: observability, incident simulation, root-cause analysis, RAG diagnostics, agent traces, recovery decisions and measurable release gates.

## Capabilities

- Live production telemetry simulation
- Six AI failure scenarios
- Evidence-led incident RCA
- Blast-radius assessment
- Recovery and rollback recommendations
- RAG retrieval diagnostics
- Agent trace explorer
- Deterministic release-readiness API
- Production `/health` endpoint
- Railway-ready Node.js runtime
- No external LLM key or environment secret required

## API

- `GET /health`
- `GET /api/metrics`
- `GET /api/incidents`
- `POST /api/incidents/simulate`
- `GET /api/agent-trace`
- `GET /api/architecture`
- `POST /api/release/evaluate`

## Run locally

```bash
npm start
```

The server uses `PORT` when supplied by the platform and defaults to `8080` locally.

## Professional positioning

Ashok Kumar Manohar — Test Architect · AI Quality Engineer · Forward Deployed AI Engineer
