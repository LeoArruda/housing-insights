Here’s a clean, professional README.md aligned with your project, your AGENTS.md, and your overall direction (signals platform + multi-agent dev).

⸻


# 🇨🇦 Canadian Economy & Housing Signals Platform

A modular, API-first data platform designed to collect, process, and analyze signals from the Canadian economy and housing market.

This project leverages a **multi-agent, spec-driven development approach** to build a scalable and maintainable foundation for:

- macroeconomic monitoring  
- housing market analysis  
- release detection and signal tracking  
- future analytics, dashboards, and decision support tools  

---

## 🚀 What This Project Is

This is not just an app — it is a **data platform**.

The system continuously ingests and structures data from official sources such as:

- Statistics Canada (WDS / SDMX)
- Bank of Canada (Valet API + RSS)
- CMHC (housing data and reports)
- CREA (housing market statistics)
- Other public datasets and release feeds

The goal is to transform fragmented public data into a **cohesive, queryable, and analyzable signal layer**.

---

## 🎯 Objectives

### 1. Automated Data Ingestion
- API-first integration strategy  
- RSS-based release detection  
- Minimal, controlled scraping only when necessary  

### 2. Structured Data Layers
- Raw payload storage (source of truth)  
- Normalized data (cleaned + validated)  
- Curated data (analytics-ready)  

### 3. Signal Detection
- New data releases  
- Economic changes (CPI, GDP, rates)  
- Housing trends (prices, inventory, sales)  

### 4. Scheduling & Automation
- Hourly, daily, monthly ingestion jobs  
- Source-specific refresh cadence  
- Event-driven ingestion (via RSS feeds)  

### 5. Extensibility
- Easily add new data sources  
- Support future dashboards and APIs  
- Enable advanced analytics and ML use cases  

---

## 🧠 Why This Exists

Public economic and housing data in Canada is:

- fragmented across multiple sources  
- inconsistent in format  
- released on different schedules  
- difficult to analyze holistically  

This project solves that by creating a **unified signal platform** that:

- standardizes data  
- tracks changes over time  
- enables faster analysis and insights  

---

## 🏗️ Architecture Overview

The system follows a layered ingestion model:

[ External Sources ]
↓
[ Connectors ]
↓
[ Raw Layer ]
↓
[ Normalization Layer ]
↓
[ Curated Data Layer ]
↓
[ Signals / Insights ]
↓
[ APIs / Dashboards (future) ]

### Key Principles

- API-first, scraper-second  
- Idempotent ingestion pipelines  
- Strong typing and validation  
- Clear separation of concerns  
- Full data lineage tracking  

---

## 🧩 Tech Stack

### Backend
- **Bun**
- **TypeScript**
- **SQLite** (first iteration via `bun:sqlite`; PostgreSQL later if scale or hosting needs require it)

### Data Handling
- Zod (validation)
- Cheerio (HTML parsing)
- fast-xml-parser (RSS/XML)
- Native fetch (HTTP)

### Orchestration
- Cron-based scheduling (initial)
- Job tracking + retry logic

### Frontend (planned)
- Vue 3
- Vite
- Pinia + TanStack Query
- Tailwind CSS

---

## 📁 Project Structure

```text
.cursor/         # Cursor agents, rules, and skills
docs/            # architecture, specs, decisions
apps/            # application entry points (api, web)
packages/        # shared types, utils, config
src/
  connectors/    # external data integrations
  ingestion/     # raw → normalized → curated pipelines
  jobs/          # scheduled jobs
  domain/        # core business models
  services/      # orchestration, signals, summaries
  db/            # schema, migrations, repositories
tests/           # unit and integration tests
scripts/         # operational scripts


⸻

⚙️ How It Works

1. Data Collection
	•	APIs (StatCan, BoC)
	•	RSS feeds (release detection)
	•	Downloads (CMHC, datasets)
	•	Limited scraping when required

2. Processing Pipeline
	•	Raw payload storage
	•	Parsing and validation
	•	Normalization into internal models
	•	Storage into curated tables

3. Signal Generation
	•	Detect new releases
	•	Track changes over time
	•	Identify trends and anomalies

⸻

⏱️ Scheduling Model

Frequency	Purpose
Hourly	RSS polling, release detection
Daily	API refresh (StatCan, BoC)
Weekly	summaries and validation
Monthly	housing market ingestion (CREA, CMHC)


⸻

🤖 Multi-Agent Development

This project is designed to work with Cursor multi-agents.

Each agent has a clear responsibility:
	•	Architect → system design
	•	Source Integration → external connectors
	•	Data Modeling → schema and domain
	•	Ingestion → pipelines and jobs
	•	QA → validation and testing

All development follows a spec-driven workflow:

docs/specs/<feature>/
  ├─ spec.md
  ├─ plan.md
  └─ tasks.md


⸻

🔒 Principles & Guardrails
	•	Do not trust external data → always validate
	•	Do not scrape if API exists
	•	Preserve raw data
	•	Ensure idempotent jobs
	•	Keep modules small and explicit
	•	Avoid unnecessary abstraction

⸻

🧪 Testing Strategy
	•	Unit tests for parsing and normalization
	•	Integration tests for ingestion pipelines
	•	Fixtures for external payloads
	•	No dependency on live APIs in tests

⸻

🚧 Current Status

Early-stage development.

Initial milestone includes:
	•	project scaffold
	•	SQLite schema (migrations)
	•	StatCan + BoC connectors
	•	RSS ingestion
	•	scheduling framework

⸻

🔮 Future Directions
	•	dashboard for macro + housing insights
	•	alerting system (e.g., CPI surprise, rate change)
	•	LLM-powered summaries
	•	predictive analytics and modeling
	•	integration with decision-support tools

⸻

🤝 Contributing

This project follows strict architectural and development rules defined in:

AGENTS.md

Before contributing:
	•	follow spec-driven workflow
	•	keep changes small and focused
	•	respect module boundaries
	•	update tests and docs

⸻

📌 Final Note

This project is designed to evolve into a long-term analytics foundation.

The focus is not speed — it is correctness, structure, and scalability.

Build it as if it will be used for years.