# Claude Instructions — chatmaxxing

## Orientation (read this first in every session)

Before doing any work, read `docs/CLAUDE_CONTEXT.md`. It contains the architecture map, file locations, deployment instructions, key patterns, and current branch state. Reading it takes ~60 seconds and prevents most orientation mistakes.

For the full product description (human-readable, PM-style), see `docs/PRODUCT.md`.

## Document Maintenance

Whenever you make changes that affect architecture, add/modify tasks, change deployment behavior, or alter significant LLM prompt patterns, update the relevant section of `docs/CLAUDE_CONTEXT.md`. If the change is significant enough to affect how a product stakeholder understands the system, also update `docs/PRODUCT.md`. Keep updates narrow — only touch what changed.

## Key Rules

- Never push directly to main. All changes go through a PR.
- Always set `$env:OPENAI_API_KEY` before running `cdk deploy` or autopilot silently breaks.
- Lambda deploys are immediate. Frontend changes require a gh-pages push or PR merge to go live.
- Typecheck before every Lambda deploy: `cd cdk; npx tsc --noEmit`
- When modifying `FORBIDDEN_TOPICS` in `autopilot-turn/handler.ts`, remember it applies to all 19 task experts simultaneously — scope changes carefully.
