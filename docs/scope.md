# Scope

## Scope overview

This document defines the initial scope boundaries for the project.

At this stage, the goal is to establish the foundation for the application and the delivery workflow, not to fully define every product feature in detail.

The initial scope focuses on creating a usable foundation that supports future feature delivery through a spec-driven process.

## In scope for the initial foundation

### 1. Project foundation
Set up the repository structure, standards, and conventions required to support multi-agent development.

This includes:

- root documentation structure
- agent operating model
- frontend and backend application structure
- shared package structure
- testing structure
- environment and configuration conventions

### 2. Frontend foundation
Create the initial frontend structure using:

- Vue 3
- Vite
- TypeScript
- Vue Router
- Pinia for minimal global client state
- TanStack Query for server state
- Tailwind CSS

This includes:

- app bootstrap
- routing foundation
- layout foundation
- feature/module structure
- shared UI conventions
- typed API integration approach

### 3. Backend foundation
Create the initial backend structure using:

- Bun
- TypeScript
- modular backend architecture
- typed validation at system boundaries
- clear service and domain separation

This includes:

- application bootstrap
- route registration
- module structure
- error handling conventions
- validation conventions
- environment configuration
- testable service boundaries

### 4. Shared contracts and conventions
Define and document the shared standards required for consistent development.

This includes:

- API conventions
- naming conventions
- file placement conventions
- feature folder conventions
- documentation expectations
- ADR usage expectations

### 5. Spec-driven workflow foundation
Establish the initial process for feature delivery using:

- `spec.md`
- `plan.md`
- `tasks.md`

This includes:

- templates or reference examples
- expected ownership by agent role (see [AGENTS.md](../AGENTS.md) **Agent boundaries** and [.cursor/agents/](../.cursor/agents/))
- definition of done expectations (**`tasks.md` canonical**, PRD alignment, `verification.md` when present)
- reporting expectations after implementation
- Cursor-wide reminder: [.cursor/rules/spec-driven-delivery.mdc](../.cursor/rules/spec-driven-delivery.mdc) (`alwaysApply`)

## In scope for the first implementation slices

Once the foundation exists, the first implementation slices should focus on a small vertical feature set that validates the workflow end to end.

The first slices should ideally prove:

- frontend to backend communication
- shared contract usage
- validation and error handling
- one or two complete user flows
- the ability to test and evolve features without structural rework

## Out of scope for now

The following are explicitly out of scope for the initial phase unless later approved through feature specs:

- broad feature expansion before the core structure is stable
- advanced microservices decomposition
- premature optimization for scale
- highly customized infrastructure automation
- large design system investment before repeated UI patterns emerge
- speculative abstractions for future unknown needs
- complex offline support
- multi-tenant architecture unless explicitly required
- plugin systems or extensibility frameworks before the base product proves the need

## Scope control rules

To keep the project disciplined:

### New features must start with a spec
No meaningful feature should begin implementation without a documented spec.

### MVP decisions should be explicit
When there is uncertainty, choose the smallest useful version first.

### Non-goals should be documented
Features should clearly state what is not included to avoid silent scope creep.

### Cross-cutting changes require review
Changes that affect multiple areas of the system should be reviewed by the Architect Agent or the human owner.

## Initial assumptions

The current working assumptions are:

- the application will be built as a modern web app
- the frontend will use Vue 3
- the backend will use Bun with TypeScript
- the first iteration uses **SQLite** for persistence (e.g. `bun:sqlite`); a move to PostgreSQL or another store is a later decision if requirements demand it
- the project will be modular, but not over-engineered
- the product will be developed iteratively through small vertical slices
- the agentic workflow is part of the project objective, not just the implementation method

## Open scope items

The following still need to be clarified later through product-specific specs:

- exact business domain and first feature set
- authentication requirements
- long-term production database strategy (first iteration: SQLite)
- deployment targets
- observability requirements
- external integrations, if any

Until these are defined, the foundation should remain flexible enough to support them without prematurely committing to unnecessary complexity.