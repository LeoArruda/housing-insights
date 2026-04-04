Great — I reviewed your existing file and kept what’s strong (spec-driven flow, agent discipline, repo shape), but tightened the goals, aligned it with your data platform use case, and made it more actionable for Cursor multi-agents.

Below is a clean, improved AGENTS.md that:
	•	clearly defines the product goal (signals platform)
	•	preserves your spec-driven workflow
	•	integrates multi-agent responsibilities with your architecture
	•	aligns with your Bun + TS + ingestion platform direction
	•	keeps your repo structure but refines it for this project

⸻

✅ Improved AGENTS.md

# AGENTS.md

## Project Overview

This repository contains a **multi-agent, spec-driven application** focused on building a:

> **Canadian Economy & Housing Signals Platform**

The system collects, processes, and analyzes signals from:
- Statistics Canada
- Bank of Canada
- CMHC
- CREA
- Other official/public sources

The objective is to create a **reliable, extensible data platform** that enables:
- automated ingestion of macro + housing data
- structured storage and normalization
- signal detection and trend analysis
- future dashboards, APIs, and insights

This project is built using:
- **Bun + TypeScript**
- **PostgreSQL**
- **API-first ingestion architecture**
- **multi-agent collaboration using Cursor**

---

## Project Goals (Non-Negotiable)

### 1. Build a reliable ingestion platform
- API-first (StatCan, BoC)
- minimal and controlled scraping only when required
- idempotent and schedulable pipelines

### 2. Create a reusable data foundation
- raw + normalized + curated layers
- strong lineage tracking
- time-series friendly schema

### 3. Enable signal detection
- new releases (RSS-driven)
- economic changes (CPI, rates, GDP)
- housing trends (sales, inventory, prices)

### 4. Support automation and scheduling
- hourly, daily, monthly jobs
- per-source cadence
- event-driven ingestion (RSS triggers)

### 5. Be agent-friendly by design
- modular structure
- clear ownership boundaries
- spec-driven development
- predictable patterns

---

## Development Model (Spec-Driven)

All meaningful work must follow:

docs/specs//
├─ spec.md
├─ plan.md
└─ tasks.md

### Required Flow

1. **Scope**
   - define problem
   - define MVP boundaries
   - define acceptance criteria

2. **Plan**
   - define architecture and approach
   - define contracts and dependencies

3. **Tasks**
   - split into small units
   - assign to agents

4. **Implementation**
   - small, testable increments
   - preserve architecture

5. **Validation**
   - tests updated
   - acceptance criteria verified

🚫 No large implementation without spec + plan.

---

## Core Architecture

The system follows a layered ingestion model:

### 1. Connectors
- external integrations (APIs, RSS, downloads)
- no business logic
- return raw payloads only

### 2. Raw Layer
- store payloads exactly as received
- track metadata (source, timestamp, checksum)

### 3. Normalization Layer
- map source → internal model
- validate data
- preserve lineage

### 4. Curated Layer
- analytics-ready tables
- consistent time-series structure

### 5. Signal Layer
- derived insights:
  - new release detected
  - rate change
  - trend shifts
  - anomalies

### 6. Orchestration Layer
- scheduling
- job tracking
- retries
- idempotency

---

## Multi-Agent Roles

### Orchestrator Agent
- controls execution flow
- ensures spec-driven process
- avoids overlap/conflicts

---

### Product Scope Agent
- defines feature scope
- writes `spec.md`
- defines acceptance criteria

---

### Architect Agent
- defines structure and boundaries
- enforces architecture
- prevents drift
- owns `docs/architecture.md`

---

### Source Integration Agent
- builds connectors:
  - StatCan WDS
  - BoC Valet
  - RSS feeds
  - CMHC/CREA ingestion

Rules:
- API first
- no scraping unless justified
- isolate source logic

---

### Data Modeling Agent
- designs schema
- ensures lineage
- supports time-series analysis

Owns:
- `packages/types`
- DB schema
- `docs/data-model.md`

---

### Ingestion Pipeline Agent
- implements pipelines:
  - raw → normalized → curated
- ensures idempotency
- handles job orchestration

---

### Backend Agent
- builds services:
  - scheduling
  - signals
  - summaries
- implements APIs if needed

---

### Frontend Agent (future)
- Vue 3 app
- dashboards
- data visualization
- minimal state management

---

### QA / Review Agent
- validates behavior
- ensures acceptance criteria
- reviews code quality
- prevents regressions

---

### DevOps Agent (optional)
- scheduling infra
- CI/CD
- environment config

---

## Collaboration Rules

All agents must:

- respect module boundaries
- avoid editing unrelated areas
- prefer small PRs
- document assumptions
- escalate ambiguity
- never silently redefine architecture

Cross-cutting changes → require Architect or human approval.

---

## Engineering Principles

### 1. API-first
Never scrape if API or dataset exists.

### 2. Idempotent ingestion
Jobs must be safe to re-run.

### 3. Raw data preservation
Always store original payload.

### 4. Strong typing
Use TypeScript + validation (Zod).

### 5. Clear separation
- connectors ≠ ingestion ≠ domain ≠ jobs

### 6. Config-driven scheduling
No hardcoded schedules.

### 7. Observability
Track:
- job runs
- failures
- ingestion state

---

## Repository Structure

```text
.cursor/
  agents/
  rules/
  skills/

docs/
  architecture.md
  data-model.md
  sources.md
  scheduling.md
  specs/

apps/
  api/        # Bun backend
  web/        # Vue frontend (future)

packages/
  types/
  utils/
  config/

src/
  connectors/
  ingestion/
  jobs/
  domain/
  services/
  db/

tests/
scripts/


⸻

Scheduling Model

Each source defines its own cadence:

Source	Frequency
RSS feeds	every 30–60 min
BoC Valet	daily
StatCan WDS	daily
CREA stats	monthly (+check daily)
CMHC	monthly/quarterly

Use:
	•	cron-based scheduling
	•	event-triggered ingestion (RSS)

⸻

Coding Rules

General
	•	small, focused files
	•	explicit logic
	•	no hidden side effects

Validation
	•	validate all external data
	•	never trust payloads

HTTP
	•	retries + backoff
	•	timeouts required

Parsing
	•	separate fetch / parse / normalize

DB
	•	use migrations
	•	preserve lineage

⸻

Testing Rules

Must include:

Unit Tests
	•	parsers
	•	normalization
	•	signal logic

Integration Tests
	•	connectors
	•	ingestion flow

Fixtures
	•	API responses
	•	RSS XML
	•	HTML pages
	•	CSV/XLSX samples

🚫 Do not depend on live APIs in tests

⸻

Security & Reliability

All agents must:
	•	treat input as untrusted
	•	validate boundaries
	•	avoid leaking secrets
	•	ensure retry-safe operations
	•	avoid silent failures

⸻

Cursor Rules & Skills

Rules (.cursor/rules/)
	•	architecture constraints
	•	TS standards
	•	ingestion rules
	•	DB rules
	•	testing rules
	•	agent behavior

⸻

Skills (.cursor/skills/)

Reusable patterns:
	•	connector design
	•	RSS ingestion
	•	API client patterns
	•	scraping safeguards
	•	normalization patterns
	•	schema design
	•	scheduling
	•	observability

⸻

Definition of Done

A task is complete when:
	•	code compiles
	•	types are correct
	•	tests pass
	•	docs updated if needed
	•	no architecture violations
	•	behavior is deterministic
	•	ingestion is idempotent

⸻

Human Override

Human instructions override all agents.

Examples:
	•	“simplify” → reduce complexity
	•	“refactor” → improve structure, no redesign
	•	“production-ready” → add robustness
	•	“do not use X” → hard constraint

⸻

First Milestone

Deliver:
	•	project scaffold (Bun + TS)
	•	DB connection + migrations
	•	raw_payloads + job_runs tables
	•	StatCan RSS connector
	•	BoC RSS connector
	•	StatCan WDS connector
	•	BoC Valet connector
	•	hourly scheduler
	•	daily ingestion job
	•	basic tests

Focus on one full vertical slice, not breadth.

⸻

Final Guidance

This is not just an app.

It is a data platform foundation.

Agents must:
	•	build for evolution
	•	avoid shortcuts that break scaling later
	•	keep structure clean
	•	prioritize correctness over speed

Always leave the system better than you found it.