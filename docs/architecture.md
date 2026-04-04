# Architecture

## Architecture overview

This document defines the initial architecture direction for the project.

The application will follow a modular, spec-driven architecture designed to support:

- clear separation of concerns
- safe collaboration between multiple specialized agents
- maintainable frontend and backend code
- explicit contracts between layers
- incremental delivery through small vertical slices

The architecture should remain simple, practical, and evolvable.

## High-level system shape

The system will initially be structured as a web application composed of:

- a **frontend web app** built with Vue 3
- a **backend API** built with Bun and TypeScript
- **shared packages** for reusable UI, types, utilities, and config
- **documentation and specs** that drive delivery and decisions

Preferred repository shape:

```text
.cursor/
  agents/
  rules/
  skills/
  hooks.json

docs/
  vision.md
  scope.md
  roadmap.md
  architecture.md
  adr/
  api/
  ux/
  qa/
  specs/

apps/
  web/
  api/

packages/
  ui/
  types/
  utils/
  config/

tests/
  e2e/
  integration/
  contract/

scripts/