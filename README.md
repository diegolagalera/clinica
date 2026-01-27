# Dental Clinic ERP

A modern, multi-tenant ERP system for dental clinics with AI-powered clinical decision support.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- pnpm (recommended) or npm

### 1. Start Infrastructure

```bash
docker-compose up -d
```

This starts:
- PostgreSQL 16 with pgvector (localhost:5432)
- Redis 7 (localhost:6379)
- MinIO S3 (localhost:9000, console: localhost:9001)
- MailHog (SMTP: localhost:1025, UI: localhost:8025)

### 2. Setup Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:push    # Push schema to database
npm run dev        # Start dev server on :3000
```

### 3. Setup Frontend

```bash
cd frontend
npm install
npm run dev        # Start dev server on :5173
```

### 4. Access the Application

- Frontend: http://localhost:5173
- API: http://localhost:3000/api/v1
- MinIO Console: http://localhost:9001 (minioadmin/minioadmin)
- MailHog: http://localhost:8025

## 📁 Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/       # Environment configuration
│   │   ├── controllers/  # Route handlers
│   │   ├── db/           # Database schema & connection
│   │   ├── middleware/   # Auth, RBAC, multi-tenant
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   ├── types/        # TypeScript types
│   │   └── utils/        # Helpers
│   └── migrations/       # Database migrations
│
├── frontend/
│   ├── src/
│   │   ├── components/   # Reusable components
│   │   ├── layouts/      # App layouts
│   │   ├── pages/        # Page components
│   │   ├── router/       # Vue Router
│   │   ├── stores/       # Pinia stores
│   │   ├── services/     # API client
│   │   └── types/        # TypeScript types
│
└── docker-compose.yml    # Infrastructure
```

## 🔐 User Roles

| Role | Access |
|------|--------|
| **SUPERADMIN** | Platform management, all organizations |
| **ADMIN** | Organization management, all clinics in org |
| **WORKER** | Assigned clinic only, clinical operations |
| **USER** | Patient portal, own data only |

## 🏗️ Architecture Highlights

- **Multi-tenant**: Data isolation by `organization_id` and `clinic_id`
- **RBAC**: Role-based access control with middleware
- **JWT Auth**: Access + Refresh tokens with rotation
- **2FA**: TOTP-based for ADMIN/SUPERADMIN
- **S3 Storage**: Radiographs and documents in MinIO/S3
- **AI Ready**: pgvector for embeddings, AI analysis endpoints

## 📋 Development Status

- [x] Project scaffolding
- [x] Database schema
- [x] Authentication system
- [x] Multi-tenant middleware
- [x] Frontend with Vue 3 + Tailwind
- [x] Role-based routing
- [ ] Complete CRUD endpoints
- [ ] Appointment calendar
- [ ] Radiograph viewer
- [ ] AI integration
- [ ] Production deployment

## 🛠️ Tech Stack

**Backend:**
- Node.js + Express
- TypeScript
- Drizzle ORM
- PostgreSQL + pgvector
- JWT + bcrypt

**Frontend:**
- Vue 3 (Composition API)
- Vite
- TypeScript
- TailwindCSS
- Pinia
- Vue Router

## 📄 License

Proprietary - All rights reserved
# clinica
