---
kind: external_dependency
name: PostgreSQL hosted on Railway
slug: postgresql-railway
category: external_dependency
category_hints:
    - vendor_identity
    - client_constraint
scope:
    - '**'
---

### PostgreSQL on Railway
- The only relational database in the project; Prisma datasource points to a `DATABASE_URL` environment variable.
- Hosted on Railway (`altaria.proxy.rlwy.net:10368/railway`) — the connection string is committed as an example and must be replaced per environment via `.env`.
- All timestamps (`openTime`, `closeTime`, `createdAt`, `submittedAt`, `releasedAt`) are stored as UTC; the scheduler compares against UTC, so timezone handling is client-side only.
- Deployment target for the backend service is Railway (per tech-stack docs).
- Verify exact host/port/database name against the active Railway dashboard before deploying.