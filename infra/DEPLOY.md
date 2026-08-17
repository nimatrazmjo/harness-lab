# Deploy notes — AWS provisioning

This build is developed and tested locally (`infra/docker-compose.yml` runs Postgres+pgvector
as a stand-in for RDS; `apps/api` runs on localhost). Deploying to real AWS requires an AWS
account and credentials that only a human with billing authority can provide — an agent should
not create billed cloud resources unattended. The steps below are written to run by hand (or via
IaC you commit under `infra/`) once that access exists.

## 1. RDS PostgreSQL (private, pgvector)
- Engine: PostgreSQL 16, instance in a **private subnet** (no public IP).
- Security group: inbound 5432 **only** from the EC2 instance's security group.
- Enable `CREATE EXTENSION vector;` after first connect (done automatically by the first
  migration, `apps/api/migrations/*_enable_pgvector.sql`).
- Verify: from outside the VPC, `psql` to the RDS endpoint must time out / be refused.

## 2. EC2 + nginx + TLS
- EC2 instance in a public subnet (or public subnet + NAT), security group open on 80/443 only.
- Install nginx, deploy `infra/nginx.conf`, obtain a cert via certbot (Let's Encrypt) —
  `certbot --nginx -d <domain>`. No self-signed certs.
- Run `apps/api` as a service (systemd) bound to `127.0.0.1:3000` — never 0.0.0.0:80/443.
- Verify: `scripts/verify-tls.sh <domain>`.

## 3. Secrets Manager
- Store `DATABASE_URL`, `JWT_SECRET`, and the AI provider credentials as a single JSON secret.
- Attach an IAM role to the EC2 instance with `secretsmanager:GetSecretValue` scoped to that
  secret's ARN only — no long-lived AWS keys on disk.
- `apps/api/src/config/secrets.ts` reads `SECRETS_MANAGER_SECRET_ID` + `AWS_REGION` and fetches
  at boot when `NODE_ENV=production`; falls back to `.env` locally.

## 4. IAM
- EC2 instance role: `secretsmanager:GetSecretValue` (scoped), plus Bedrock invoke permissions
  if `AI_PROVIDER=bedrock`.
- No IAM user access keys anywhere in the repo or on the instance.

## Status
Not yet executed against a real AWS account — the app, migrations, and configs above are ready
to point at RDS/EC2 as soon as that access is available. Track in `feature-list.json`:
`infra.rds_postgres_private` and `infra.ec2_nginx_tls` stay `blocked` until this runs for real.
