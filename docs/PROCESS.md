# Development & Deployment Process

The single rule everything else serves: **`main` always equals production.** If it's on `main`,
it's deployed; if it's deployed, it's on `main`. Nothing reaches prod except by merging to `main`.

## Environments

| | Backend (AWS) | Frontend | Data |
|---|---|---|---|
| **dev** | `bobs-*-dev` tables + `BobsLambdaStack-dev` API (`https://1cppcq9q57…`) | `npm run dev` (local) | Isolated dev demo data — mutate/seed/break freely |
| **prod** | `bobs-*` tables + `BobsLambdaStack` API (`https://0y3s5vq2v5…`) | GitHub Pages (auto-deployed from `main`) | Live demo data |

Dev is a full parallel copy created by the same CDK code with a `-dev` suffix (`STAGE=dev`). It
costs ~$0 idle (everything is on-demand). **Connect/live-chat is shared with prod** — there is no
second Connect instance, so chat handoff testing still happens against prod; everything else
(portal, transactions, account data, execute-task, autopilot logic) is fully isolated in dev.

## The loop

```
1. branch off main:        git checkout main && git pull && git checkout -b feature/x
2. (backend changes) push them to dev:   cd cdk && npm run deploy:dev
3. test locally:           cd customer-app && npm run dev    # hits the DEV API + dev data
4. open a PR:              git push -u origin feature/x && gh pr create
5. CI gate runs:           builds both apps + typechecks CDK + bundle-checks Lambdas
6. merge when green:       gh pr merge --squash --delete-branch
7. prod deploys itself:    merging triggers GitHub Actions →
                              - deploy-cdk.yml      → CDK to prod (guarded)
                              - deploy-customer/agent → frontends to GitHub Pages
```

You never deploy prod by hand. `git push` to a feature branch is fine; pushing to `main` is blocked.

## Local dev points at dev (not prod)

`customer-app/.env.development` / `agent-app/.env.development` set `VITE_API_URL` to the **dev** API,
so `npm run dev` uses dev data. To temporarily test local against prod, set `VITE_API_URL` to the
prod URL in `.env.local` (gitignored; it overrides `.env.development`).

## What's in prod? (transparency)

- **Backend:** GitHub → **Actions / Environments → production** shows the exact commit last deployed.
  Or run `cd cdk && npx cdk diff BobsDataStack BobsLambdaStack` — "no differences" means `main` == prod.
- **Frontend:** open the site console — it logs `build <sha>` and sets `window.__BUILD__` to the
  deployed commit. The deploy-customer-app / deploy-agent-app Action runs also show the commit.

## Deploys are guarded

All CDK deploys (CI and manual) go through `cdk/scripts/safe-deploy.mjs`: **typecheck → `cdk diff`
→ refuse to deploy if any live resource would be removed or replaced** (override only with
`ALLOW_DESTROY=1`). This is why a stale-branch deploy can no longer silently delete prod resources.

## Commands

```powershell
cd cdk
npm run deploy:dev      # deploy backend to DEV (manual, on demand, from any branch)
npm run deploy:lambda   # deploy backend to PROD (normally CI does this; manual escape hatch)
npm run deploy -- <Stack> [<Stack>...] --require-approval never   # specific stacks
```
Seed/reset demo data (per environment): `GET <api-url>/reset-client-data?key=bobs-reset-2025`.

Rarely-changed prod stacks (`BobsLexStack`, `BobsConnectStack`, `BobsBudgetStack`, `BobsCicdStack`)
are deployed manually when they change; CI only deploys `BobsDataStack` + `BobsLambdaStack`.

## Nightly fund-data refresh (automated)

The fund pages' real market data refreshes itself every night — no human in the loop:

1. **07:10 UTC** — EventBridge Scheduler runs the `bobs-fund-data-refresh` Lambda (Yahoo →
   `bobs-fund-market` table). This is the authoritative refresh; it keeps the DATABASE current.
2. **07:30 UTC** — the **Refresh Fund Data** GitHub workflow re-triggers only if that run is
   missing/stale (`ifStaleMinutes` guard), then exports the payloads to static JSON and publishes
   them to gh-pages `/fund-data/` (same-origin, zero-latency reads for the customer app).

Manual controls: run the workflow from the Actions tab (`workflow_dispatch`), or refresh just the
DB with `GET <api-url>/refresh-fund-data?key=bobs-reset-2025` (202 → poll
`GET /fund-market?status=1`). **A failed night is safe:** the exporter validates every payload
before writing anything, so the previously published files stay live, and the frontend falls back
to the live `/fund-market` API → then to static bundled data. Note GitHub disables cron workflows
after 60 days without repo activity — if the repo goes dormant, re-enable it from the Actions tab
(the EventBridge half never stops).

## Rollback

Revert the merge commit on `main` (`git revert -m 1 <merge-sha>` or the "Revert" button) and merge
that — the deploy workflows redeploy the previous state automatically.

## Cost safety

`BobsBudgetStack` emails the owner at 80% actual / 100% forecast of a $15/month budget. Dev
resources are tagged `Stage=dev` for Cost Explorer breakdown.
