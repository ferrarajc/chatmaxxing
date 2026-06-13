# Claude Instructions — chatmaxxing

## Orientation (read this first in every session)

Before doing any work, read `docs/CLAUDE_CONTEXT.md`. It contains the architecture map, file locations, deployment instructions, key patterns, and current branch state. Reading it takes ~60 seconds and prevents most orientation mistakes.

For the full product description (human-readable, PM-style), see `docs/PRODUCT.md`.

## Document Maintenance

Whenever you make changes that affect architecture, add/modify tasks, change deployment behavior, or alter significant LLM prompt patterns, update the relevant section of `docs/CLAUDE_CONTEXT.md`. If the change is significant enough to affect how a product stakeholder understands the system, also update `docs/PRODUCT.md`. Keep updates narrow — only touch what changed.

## Key Rules

- Never push directly to main. All changes go through a PR.
- `OPENAI_API_KEY` is stored in AWS SSM (`bobs-openai-api-key`) and resolved by CloudFormation at deploy time — no shell variable needed.
- Lambda deploys are immediate. Frontend changes require a gh-pages push or PR merge to go live.
- When modifying `FORBIDDEN_TOPICS` in `autopilot-turn/handler.ts`, remember it applies to all 19 task experts simultaneously — scope changes carefully.

## Deploying the backend (CDK) — read before any deploy

CloudFormation reconciles a stack to whatever template you deploy, so deploying a branch that is
**missing** a resource that exists in production **deletes that resource**. This has bitten us
(a stale-branch deploy removed a live Lambda + route). Two standing rules:

1. **Deploy only through the guarded command — never raw `cdk deploy`:**
   ```powershell
   cd cdk; npm run deploy:lambda        # = DataStack + LambdaStack, the normal case
   # or, for specific stacks / flags:
   cd cdk; npm run deploy -- <Stack> [<Stack>...] --require-approval never
   ```
   `scripts/safe-deploy.mjs` typechecks, runs `cdk diff`, and **aborts if the deploy would remove
   or replace any live resource** unless you set `ALLOW_DESTROY=1` for a genuinely intended removal.
   It replaces the old `npx tsc --noEmit` + `cdk deploy` steps (both are now built in).

2. **Only deploy from a branch that is up to date with what's deployed.** `main` can lag behind
   production when work is deployed before its PR merges (see `docs/CLAUDE_CONTEXT.md` → current
   state). Before deploying, branch off / rebase onto the current production tip, not blindly off
   `main`. If `npm run deploy` blocks with a REMOVE list, that's this rule firing — rebase, don't override.
