## Mission
Build this product using a spec-first workflow. Do not jump into implementation before the relevant spec, plan, and task breakdown exist.

## Core Rules
1. Prefer small, reviewable changes.
2. Do not edit files outside your ownership unless the orchestrator explicitly allows it.
3. Before coding a feature, confirm these files exist:
   - docs/specs/<feature>/spec.md
   - docs/specs/<feature>/plan.md
   - docs/specs/<feature>/tasks.md
4. If architecture changes are needed, create or update an ADR in docs/adr/.
5. Preserve clear interfaces between apps/ and packages/.
6. Add or update tests for every functional change.
7. Never invent product requirements. If unclear, propose options and assumptions explicitly.
8. Always report:
   - what changed
   - what remains
   - risks
   - follow-up tasks

## Definition of Done
A task is done only when:
- acceptance criteria are covered
- code compiles
- tests pass
- lint/typecheck pass
- docs are updated where relevant
- no known critical regression remains

## Ownership Boundaries
- Product Scope Agent: docs/vision.md, docs/scope.md, docs/roadmap.md, docs/specs/**/spec.md
- Architect Agent: docs/architecture.md, docs/adr/**, docs/api/conventions.md, package boundaries
- Frontend Agent: apps/web/**, packages/ui/**, frontend tests
- Backend Agent: apps/api/**, packages/types/**, packages/utils/**, DB/API contracts
- QA Agent: tests/**, docs/qa/**
- DevOps Agent: scripts/**, CI, deployment, environment setup

## Preferred Workflow
1. Scope
2. Spec
3. Plan
4. Tasks
5. Implementation
6. Validation
7. Release notes