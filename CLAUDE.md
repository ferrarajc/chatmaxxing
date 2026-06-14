# Claude Instructions — chatmaxxing

## Orientation (read this first in every session)

Before doing any work, read `docs/CLAUDE_CONTEXT.md`. It contains the architecture map, file locations, deployment instructions, key patterns, and current branch state. Reading it takes ~60 seconds and prevents most orientation mistakes.

For how we build, test, and ship — environments (dev vs prod), the branch → dev-test → PR → auto-deploy loop, and how to see what's in prod — see **`docs/PROCESS.md`**.

For the full product description (human-readable, PM-style), see `docs/PRODUCT.md`.

## Document Maintenance

Whenever you make changes that affect architecture, add/modify tasks, change deployment behavior, or alter significant LLM prompt patterns, update the relevant section of `docs/CLAUDE_CONTEXT.md`. If the change is significant enough to affect how a product stakeholder understands the system, also update `docs/PRODUCT.md`. Keep updates narrow — only touch what changed.

## Key Rules

- Never push directly to main. All changes go through a PR.
- **`main` == production.** Merging to `main` is what deploys: GitHub Actions deploy the backend (CDK) and the frontends. You don't deploy prod by hand — test on the **dev** environment first. See the Deploying section below and `docs/PROCESS.md`.
- `OPENAI_API_KEY` is stored in AWS SSM (`bobs-openai-api-key`) and resolved by CloudFormation at deploy time — no shell variable needed.
- When modifying `FORBIDDEN_TOPICS` in `autopilot-turn/handler.ts`, remember it applies to all 19 task experts simultaneously — scope changes carefully.

## Deploying — read before any deploy (full detail in `docs/PROCESS.md`)

**Prod deploys happen automatically via GitHub Actions on merge to `main`** (`deploy-cdk.yml` for the
backend via OIDC; `deploy-customer-app` / `deploy-agent-app` for the frontends). You normally don't
deploy prod by hand. Test backend changes in the **dev** environment first: `cd cdk; npm run deploy:dev`,
then `npm run dev` (which targets the dev API + dev data, never prod).

CloudFormation reconciles a stack to whatever template you deploy, so deploying a branch **missing** a
resource that exists in prod **deletes it** (this has bitten us). Therefore:

1. **Deploy only through the guarded command — never raw `cdk deploy`.** `scripts/safe-deploy.mjs`
   typechecks, runs `cdk diff`, and **aborts if the deploy would remove or replace a live resource**
   (override only with `ALLOW_DESTROY=1`). Used by CI and by the manual escape hatch:
   ```powershell
   cd cdk; npm run deploy:dev      # backend → DEV (on demand)
   cd cdk; npm run deploy:lambda   # backend → PROD (CI does this on merge; manual fallback)
   ```
2. **Only deploy from `main` (or a branch current with it).** If `npm run deploy` blocks with a
   REMOVE list, your branch is behind prod — rebase onto `main`, don't reach for `ALLOW_DESTROY`.
