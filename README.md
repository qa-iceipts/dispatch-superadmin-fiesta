# dispatcher-superadmin

Platform-admin microservice (product-agnostic, reusable across Iceipts projects).
Owns: **tenant registry, entitlements (gov-API pay-gate), quotas** — and later
usage metering (M2) and billing/invoices (M3) + superadmin console (M4).

See `gvpr-backend/DOCS/SUPERADMIN_MICROSERVICE_PLAN.md` for the full design.

## Stack
Node 22 · Express · Sequelize · MySQL.

## Setup
```bash
cp .env.example .env   # set DB creds + SUPERADMIN_API_TOKEN
npm install
npm run start:dev      # creates the DB if missing, syncs models, listens on PORT (9000)
```

## Concepts
- **product** — a client app (e.g. `GVPR`). Authenticates server-to-server with an API key.
- **tenant** — a billable unit within a product. For GVPR a tenant = one mine; `externalRef` = the MINES user's `userId`.
- **subscription** — billing state per tenant (TRIAL/ACTIVE/SUSPENDED, paidUntil, govApiAccessOverride).
- **quota** — generic per-tenant limit (e.g. `maxEmployees`).
- **entitlement** — derived: `govApiAccess = tenant ACTIVE && (override ?? (TRIAL | ACTIVE&paid))`.

## API
### Integration (product backends) — headers `x-product`, `x-api-key`
- `POST /v1/tenants` `{ externalRef, name?, metadata? }` — onboard/upsert a tenant (creates TRIAL subscription).
- `GET /v1/entitlement?tenantRef=<externalRef>` — `{ govApiAccess, billingStatus, quotas }`. Unknown tenant ⇒ `govApiAccess:false`.

### Admin (superadmin console) — header `x-admin-token` (M1 placeholder)
- `POST /admin/products` `{ name }` → returns raw `apiKey` **once**.
- `GET /admin/tenants` · `GET /admin/tenants/:id`
- `PUT /admin/tenants/:id/billing` `{ billingStatus?, paidUntil? }` (mark paid)
- `PUT /admin/tenants/:id/gov-access` `{ override?, status? }`
- `PUT /admin/tenants/:id/quota` `{ key, value }`

## Integration with GVPR (next steps, in apiserver/transport)
1. **Bootstrap:** `POST /admin/products {name:"GVPR"}` → put the returned key in apiserver/transport env (`PLATFORM_ADMIN_URL`, `PLATFORM_ADMIN_API_KEY`).
2. **Onboarding:** apiserver `clientRegister` (isMines) → `POST /v1/tenants {externalRef: <mine userId>}`.
3. **Entitlement:** apiserver auth-verify calls `GET /v1/entitlement?tenantRef=<userId>` (cached) and returns `govApiAccess` to transport; transport's `requireGovApiEntitlement` enforces it.
4. **Metering (M2):** transport publishes usage events (RabbitMQ) → this service.

## Roadmap
- **M1 (this):** skeleton + tenant registry + entitlement + API-key auth.
- **M2:** usage metering (RabbitMQ ingestion, usageEvents + rollups).
- **M3:** invoices + line items + mark-paid → entitlement.
- **M4:** quotas enforcement wiring + superadmin console (FE) + real SA auth.
