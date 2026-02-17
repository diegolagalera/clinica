---
description: How to apply database schema changes (new tables, columns) to all tenant databases
---

# Database Migration Workflow

When you modify `backend/src/db/schema.ts` (add tables, columns, etc.), follow these steps:

// turbo-all

1. Generate the migration SQL:
```bash
cd backend && npm run db:generate
```

2. Apply migrations to ALL tenant databases:
```bash
cd backend && npm run tenant:migrate-all
```

3. (Optional) Apply to a single specific tenant:
```bash
cd backend && npx tsx src/scripts/migrate-all-tenants.ts --slug my-tenant-slug
```

> **Reference:** Full documentation in `backend/docs/MULTI-TENANT.md`
