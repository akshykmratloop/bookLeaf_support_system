# Deployment (live demo)

The demo runs in two places:

| Part | Where | URL |
| --- | --- | --- |
| Support web app + widget (`apps/web`) | Vercel, project `bookleaf-support-ak` | https://bookleaf-support-ak.vercel.app |
| BookLeaf author dashboard (`apps/host-web`) | Vercel, project `bookleaf-authors` | https://bookleaf-authors.vercel.app |
| Support API (`apps/api`) | AWS, one EC2 box | `https://api.<ip-with-dashes>.sslip.io` |
| BookLeaf server (`apps/host-demo`) | same box | `https://host-api.<ip-with-dashes>.sslip.io` |

The browser only talks to the two `vercel.app` sites. Vercel forwards `/api/*` (and the dashboard's
`/login`, `/logout`, `/me`, `/support-token`) to the box, so cookies stay first-party and the apps
need no cross-site setup. The one exception is a voice call: Vercel cannot forward WebSockets, so
the browser connects straight to the API with a one-time ticket that is valid for 60 seconds.

**The widget page comes from the API.** Each workspace has its own widget address,
`/embed/<slug>`, and only that workspace's allowed origins may frame it (F-18). That rule is read
from the database, so a static Vercel header cannot carry it. Instead:

- Vercel forwards `/embed` and `/embed/*` to the API
  ([`deploy/vercel/web.json.tpl`](../deploy/vercel/web.json.tpl)). The browser address stays on
  `vercel.app`.
- The API image carries the same web build (`WEB_DIST_DIR=/app/web`,
  [`deploy/Dockerfile.api`](../deploy/Dockerfile.api)). For `/embed/<slug>` the API sends that
  build's `index.html` with `frame-ancestors` set to the workspace's origins (plus `HOST_ORIGINS`
  for BookLeaf). An unknown slug is a 404; the old `/embed` redirects to `/embed/bookleaf`.
- Scripts, styles and images still come from Vercel. If the two builds differ (only one side was
  deployed), the page may name an `/assets/…` file Vercel does not have; Vercel then forwards
  `/assets/*` to the API, which has it. A file Vercel has is always served by Vercel first.
- `/embed.js` is still a static Vercel file.
- The API's page policy allows the voice WebSocket address (`PUBLIC_API_WS_ORIGIN`), because the
  widget page now carries the API's full Content Security Policy.

## What runs on AWS

Everything is in [`infra/terraform/`](../infra/terraform) (account `533063875346`, `ap-south-1`,
profile `loopmethods`), tagged `Project=bookleaf`:

- **EC2 `t4g.small`** (Ubuntu 24.04, arm64, 20 GB disk, 2 GB swap), with an Elastic IP. Only ports
  80 and 443 are open. There is no SSH: shell access is through SSM.
- **Docker Compose** ([`deploy/docker-compose.prod.yml`](../deploy/docker-compose.prod.yml)):
  Caddy (HTTPS with free Let's Encrypt certificates on `sslip.io` names), api, host-demo,
  Postgres 16, Redis 7.
- **Secrets Manager** `bookleaf/demo/env`: the whole production env as one JSON secret. Terraform
  generates the passwords and keys. The box renders it to `/opt/bookleaf/.env.prod`.
- **S3** `bookleaf-demo-releases-533063875346`: one tarball per deployed commit (kept 14 days).
- **IAM**: a role for the box (SSM, read its secret, read releases) and a GitHub OIDC role
  for deploys (only from `main`; no stored AWS keys).
- **Budget**: email to akshykmr@loopmethods.com at 80% and 100% of $25/month.

Cost is about **$18 a month** (box ≈ $12, public IP ≈ $3.6, disk ≈ $1.8, secret $0.40). Vercel
Hobby is free.

## Deploying

A push to `main` deploys only when a commit message in the push carries a flag:

| Flag in the commit message | What deploys |
| --- | --- |
| `-deploy` | backends and frontends |
| `-deploy-be` | backends only (AWS) |
| `-deploy-fe` | frontends only (Vercel) |
| none | nothing (CI still runs) |

Example: `git commit -m "fix(api): handle empty reply -deploy-be"`.

You can also run it by hand: **Actions → Deploy → Run workflow**, then pick `both`, `backend` or
`frontend`. To roll back, run the workflow from an older commit.

What the workflow ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)) does:

1. **Gate** reads every commit message in the push and decides what to deploy.
2. **Verify** runs the full CI (typecheck, lint, format, build, all tests). Nothing deploys on red.
3. **Backend**: uploads `git archive` of the commit to S3, starts the box if it is stopped, and
   runs `bookleaf-deploy <sha>` on it through SSM. On the box that script backs up the database
   (`pg_dump`, keeps 5), builds the images, starts them (the API applies migrations with
   `prisma migrate deploy` on start), seeds (idempotent), and checks both HTTPS health URLs.
   Then CI checks them again.
4. **Frontend** (after the backend when both run): builds each app, writes its `vercel.json`
   from [`deploy/vercel/`](../deploy/vercel), uploads the built files to Vercel as production,
   and checks the page and one forwarded API path.

## First-time setup

1. Create the AWS side (already done for this demo):
   ```bash
   infra/scripts/apply.sh
   ```
   It prints the GitHub values to add.
2. In GitHub → repo **Settings → Secrets and variables → Actions**, add:
   - **Secrets:** `AWS_DEPLOY_ROLE_ARN` (from the output) and `VERCEL_TOKEN` (create one at
     https://vercel.com/account/tokens, scoped to the team).
   - **Variables:** `AWS_REGION`, `BOOKLEAF_INSTANCE_ID`, `RELEASE_BUCKET`, `API_HOST`,
     `HOST_API_HOST`, `WEB_URL`, `PORTAL_URL`, `VERCEL_SCOPE` (all from the output).
3. Optional, for AI and voice: copy your AI keys into the secret, then redeploy the backend.
   ```bash
   infra/scripts/put-ai-keys.sh
   ```
   Without them the app uses its rule-based fallback and voice is off.
4. Run **Actions → Deploy → Run workflow → both**. The first run creates the two Vercel projects.

## Checking the box

```bash
export AWS_PROFILE=loopmethods
aws ssm start-session --target <instance-id>          # a shell (needs the Session Manager plugin)
sudo tail -n 100 /var/log/bookleaf/deploy.log         # last deploys
sudo docker compose -p bookleaf ps                    # containers
sudo docker compose -p bookleaf logs --tail 100 api   # API logs
```

Backups before each deploy are in `/opt/bookleaf/backups/`.

## Removing everything

```bash
VERCEL_TOKEN=<token> infra/scripts/destroy.sh
```

This deletes the box (and the demo database with it), the IP, secret, bucket, roles and budget,
and the two Vercel projects. It cannot be undone. Afterwards remove the GitHub secrets and
variables listed above.

## Notes for later

- Redis is running but unused until the Redis-backed limits and queues are built.
- The budget filter counts spend by the `Project` tag. Activate `Project` once as a cost
  allocation tag in AWS Billing so the budget can see it.
