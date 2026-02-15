# 🏗️ CUSPIA — Arquitectura DevOps & Infraestructura

> Guía completa de la infraestructura de producción, contenedores, despliegues y operaciones.

---

## 📐 Arquitectura General

```mermaid
graph TB
    subgraph Internet["🌐 Internet"]
        User["👤 Usuario"]
        GH["⚙️ GitHub (main)"]
    end

    subgraph DNS["📡 DNS (Hostinger)"]
        direction LR
        D1["cuspia.com → 46.225.137.160"]
        D2["api.cuspia.com → 46.225.137.160"]
        D3["*.cuspia.com → 46.225.137.160"]
    end

    subgraph VPS["🖥️ Hetzner VPS (CAX21 · Ubuntu 24.04 · ARM64)"]
        subgraph Docker["🐳 Docker Compose"]
            NGINX["🔀 Nginx\n:80 / :443"]
            FE["🖼️ Frontend\nVue3 + Vite\n(nginx:alpine)"]
            BE["⚡ Backend\nNode.js + Fastify\n(:3000)"]
            PG["🐘 PostgreSQL 16\n(pgvector)"]
            CPG["🐘 Central DB\n(postgres:16-alpine)"]
            RD["🔴 Redis 7"]
            MN["📦 MinIO\n(S3 compatible)"]
            CB["🔒 Certbot\n(auto-renew)"]
        end
    end

    User -->|"HTTPS"| DNS
    DNS --> NGINX
    GH -->|"SSH deploy"| VPS
    NGINX -->|"api.cuspia.com"| BE
    NGINX -->|"*.cuspia.com"| FE
    BE --> PG
    BE --> CPG
    BE --> RD
    BE --> MN
    CB -->|"renew certs"| NGINX

    style VPS fill:#1a1a2e,color:#fff
    style Docker fill:#0d1b2a,color:#fff
    style Internet fill:#e8f4f8
    style DNS fill:#fff3e0
```

---

## 🌍 Estructura de Subdominios

```mermaid
graph LR
    subgraph Dominios["Routing por subdominio"]
        ROOT["cuspia.com\n🏠 Landing Page (futuro)"]
        API["api.cuspia.com\n⚡ Backend API + WebSocket"]
        ADMIN["admin.cuspia.com\n👑 Panel Super Administrador"]
        T1["clinica-garcia.cuspia.com\n🏥 Tenant: Clínica García"]
        T2["vitaldent.cuspia.com\n🏥 Tenant: Vitaldent"]
        TN["*.cuspia.com\n🏥 Cualquier nuevo tenant"]
    end

    API -->|"Nginx upstream"| BE2["Backend :3000"]
    ADMIN -->|"Nginx upstream"| FE2["Frontend :80"]
    T1 -->|"Nginx upstream"| FE2
    T2 -->|"Nginx upstream"| FE2
    TN -->|"Nginx upstream"| FE2

    style ROOT fill:#f5f5f5,stroke:#999
    style API fill:#e3f2fd,stroke:#1976d2
    style ADMIN fill:#fce4ec,stroke:#c62828
    style T1 fill:#e8f5e9,stroke:#388e3c
    style T2 fill:#e8f5e9,stroke:#388e3c
    style TN fill:#f3e5f5,stroke:#7b1fa2
```

| Subdominio | Destino | Uso |
|---|---|---|
| `cuspia.com` | Libre | Landing page comercial (futuro) |
| `api.cuspia.com` | Backend (:3000) | API REST + WebSocket |
| `admin.cuspia.com` | Frontend (:80) | Panel del Super Administrador |
| `{slug}.cuspia.com` | Frontend (:80) | Acceso para cada tenant/empresa |

> **No hace falta crear DNS para nuevos tenants.** El registro wildcard (`*`) redirige automáticamente cualquier subdominio al VPS.

---

## 🐳 Arquitectura de Contenedores

```mermaid
graph TB
    subgraph Containers["Docker Compose — docker-compose.prod.yml"]
        direction TB

        subgraph Infra["🔧 Infraestructura"]
            PG["🐘 cuspia_db\nPostgreSQL 16 + pgvector\nPuerto interno: 5432\nVolumen: postgres_data"]
            CPG["🐘 cuspia_central_db\nPostgreSQL 16 Alpine\nPuerto interno: 5432\nVolumen: postgres_central_data"]
            RD["🔴 cuspia_redis\nRedis 7 Alpine\nPuerto interno: 6379\nVolumen: redis_data"]
            MN["📦 cuspia_minio\nMinIO (S3)\nPuertos: 9000/9001\nVolumen: minio_data"]
        end

        subgraph App["📱 Aplicación"]
            BE["⚡ cuspia_backend\nNode.js 20 Alpine\nPuerto: 3000\nMulti-stage build"]
            FE["🖼️ cuspia_frontend\nNginx Alpine\nPuerto: 80\nMulti-stage build"]
        end

        subgraph Proxy["🌐 Red Pública"]
            NX["🔀 cuspia_nginx\nNginx Alpine\nPuertos: 80, 443\nSSL Termination"]
            CB["🔒 cuspia_certbot\nLet's Encrypt\nAuto-renew cada 12h"]
        end
    end

    NX -->|proxy_pass| BE
    NX -->|proxy_pass| FE
    BE -->|DATABASE_URL| PG
    BE -->|CENTRAL_DATABASE_URL| CPG
    BE -->|REDIS_URL| RD
    BE -->|S3_ENDPOINT| MN
    CB -->|cert volumes| NX

    style Infra fill:#1b2838,color:#fff
    style App fill:#0d2137,color:#fff
    style Proxy fill:#2d1b38,color:#fff
```

### Detalles de cada contenedor

| Contenedor | Imagen | Función | Healthcheck |
|---|---|---|---|
| `cuspia_db` | `pgvector/pgvector:pg16` | DB principal de tenants | `pg_isready` cada 10s |
| `cuspia_central_db` | `postgres:16-alpine` | DB central (tenants, superadmins, global_users) | `pg_isready` cada 10s |
| `cuspia_redis` | `redis:7-alpine` | Caché, sesiones, colas | `redis-cli ping` cada 10s |
| `cuspia_minio` | `minio/minio:latest` | Almacenamiento S3 (radiografías, media) | `curl /minio/health/live` cada 30s |
| `cuspia_backend` | Custom (Node 20 Alpine) | API REST + WebSocket + Schedulers | `wget /api/v1/health` cada 30s |
| `cuspia_frontend` | Custom (Nginx Alpine) | SPA Vue 3 | - |
| `cuspia_nginx` | `nginx:alpine` | Reverse proxy + SSL + Rate limiting | - |
| `cuspia_certbot` | `certbot/certbot` | Renovación automática SSL | Loop cada 12h |

---

## 🗄️ Arquitectura de Bases de Datos

```mermaid
graph LR
    subgraph Central["cuspia_central_db"]
        SA["superadmins\n👑 Admins de plataforma"]
        TN["tenants\n🏢 Registro de empresas"]
        GU["global_users\n🔗 Routing email→tenant"]
    end

    subgraph TenantDB1["cuspia_vitaldent (tenant DB)"]
        U1["users, organizations,\nclinics, patients,\nappointments, stock..."]
    end

    subgraph TenantDB2["cuspia_clinica_garcia (tenant DB)"]
        U2["users, organizations,\nclinics, patients,\nappointments, stock..."]
    end

    TN -->|database_url| TenantDB1
    TN -->|database_url| TenantDB2
    GU -->|email routing| TN

    style Central fill:#fff3e0,stroke:#e65100
    style TenantDB1 fill:#e8f5e9,stroke:#2e7d32
    style TenantDB2 fill:#e3f2fd,stroke:#1565c0
```

### Flujo de Login Multi-Tenant

```mermaid
sequenceDiagram
    participant U as 👤 Usuario
    participant FE as 🖼️ Frontend
    participant BE as ⚡ Backend
    participant CDB as 🗄️ Central DB
    participant TDB as 🗄️ Tenant DB

    U->>FE: Accede a vitaldent.cuspia.com
    FE->>FE: Lee subdominio → slug = "vitaldent"
    FE->>BE: POST /auth/login {email, password, slug}
    BE->>CDB: Buscar tenant por slug
    CDB-->>BE: tenant.database_url
    BE->>TDB: Conectar a DB del tenant
    BE->>TDB: Verificar credenciales
    TDB-->>BE: Usuario válido ✅
    BE-->>FE: JWT (access + refresh tokens)
    FE->>FE: Guardar tokens, redirigir al dashboard
```

---

## 🔒 SSL / HTTPS

```mermaid
graph LR
    subgraph SSL["Certificados SSL (Let's Encrypt)"]
        CERT["📜 fullchain.pem\n📜 privkey.pem\n📁 /etc/letsencrypt/live/cuspia.com/"]
    end

    subgraph Domains["Dominios cubiertos"]
        D1["cuspia.com"]
        D2["api.cuspia.com"]
        D3["app.cuspia.com"]
        D4["admin.cuspia.com"]
    end

    subgraph Renewal["♻️ Renovación automática"]
        CB2["Certbot container\ncheck cada 12 horas\nrenueva si < 30 días"]
    end

    SSL --- Domains
    CB2 -->|actualiza| SSL

    style SSL fill:#e8f5e9,stroke:#2e7d32
    style Renewal fill:#fff3e0,stroke:#e65100
```

| Aspecto | Detalle |
|---|---|
| **Proveedor** | Let's Encrypt (gratuito) |
| **Duración** | 90 días |
| **Renovación** | Automática (Certbot cada 12h) |
| **Tipo** | SAN Certificate (múltiples dominios) |
| **Ubicación** | `/opt/cuspia/certbot/conf/live/cuspia.com/` |

### Añadir un nuevo subdominio al certificado

```bash
# 1. Parar Nginx temporalmente
ssh root@46.225.137.160
docker stop cuspia_nginx

# 2. Re-emitir el cert con el nuevo dominio
docker run --rm -p 80:80 \
  -v /opt/cuspia/certbot/conf:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  -d cuspia.com -d api.cuspia.com -d app.cuspia.com -d admin.cuspia.com \
  -d NUEVO_SUBDOMINIO.cuspia.com \
  --email diegolagalera12@gmail.com --agree-tos --no-eff-email --expand

# 3. Reiniciar Nginx
docker start cuspia_nginx
```

> ⚠️ **Nota**: Solo necesitas añadir subdominios al certificado si necesitan HTTPS directo. Los tenants nuevos usan el wildcard `*.cuspia.com` de Nginx, pero como el cert no es wildcard, los navegadores mostrarán un aviso SSL para subdominios no incluidos explícitamente. Si necesitas muchos tenants sin aviso, considera migrar a un certificado wildcard usando DNS-01 challenge.

---

## 🚀 Pipeline de Despliegue (CI/CD)

```mermaid
graph LR
    subgraph Dev["💻 Desarrollo Local"]
        CODE["📝 Código"]
        PUSH["git push origin main"]
    end

    subgraph GitHub["⚙️ GitHub Actions"]
        TRIGGER["🔔 Trigger:\npush to main\no manual"]
        JOB["🏃 Job: Deploy"]
    end

    subgraph VPS["🖥️ VPS (SSH)"]
        PULL["⬇️ git pull"]
        BUILD["🔨 docker compose build"]
        UP["🔄 docker compose up -d"]
        MIGRATE["🗄️ migrate-all-tenants"]
        PRUNE["🧹 docker image prune"]
    end

    CODE --> PUSH --> TRIGGER --> JOB
    JOB -->|"SSH"| PULL --> BUILD --> UP --> MIGRATE --> PRUNE

    style Dev fill:#e3f2fd
    style GitHub fill:#f3e5f5
    style VPS fill:#e8f5e9
```

### Flujo detallado

```
1. Developer hace push a `main`
       ↓
2. GitHub Actions detecta el push
       ↓
3. Se conecta al VPS vía SSH (appleboy/ssh-action)
       ↓
4. En el VPS ejecuta:
   a) cd /opt/cuspia
   b) git pull origin main
   c) docker compose build --no-cache backend frontend
   d) docker compose up -d
   e) docker exec backend migrate-all-tenants (aplica migraciones)
   f) docker image prune -f (limpia imágenes viejas)
       ↓
5. ✅ Deploy completo
```

### GitHub Secrets necesarios

| Secret | Valor | Descripción |
|---|---|---|
| `VPS_HOST` | `46.225.137.160` | IP del servidor |
| `VPS_USER` | `root` | Usuario SSH |
| `VPS_SSH_KEY` | Contenido de `~/.ssh/id_ed25519` | Clave privada SSH |

### Deploy manual

```bash
# Si prefieres desplegar manualmente:
ssh root@46.225.137.160

cd /opt/cuspia
git pull origin main
docker compose -f docker-compose.prod.yml build --no-cache backend frontend
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Ver logs
docker logs cuspia_backend --tail 50 -f
```

---

## 📁 Estructura de Archivos (DevOps)

```
clinica/
├── .github/
│   └── workflows/
│       └── deploy.yml              ← CI/CD pipeline
├── backend/
│   ├── Dockerfile                  ← Multi-stage build (Node 20 Alpine)
│   ├── .dockerignore
│   ├── scripts/
│   │   └── init-db.sql             ← Script inicial PostgreSQL
│   └── docs/
│       ├── MULTI-TENANT.md         ← Guía multi-tenant
│       ├── SUBDOMAIN-TENANCY.md    ← Guía subdominios
│       └── DEVOPS.md               ← ⭐ Este documento
├── frontend/
│   ├── Dockerfile                  ← Multi-stage build (Vite → Nginx)
│   ├── .dockerignore
│   └── nginx.conf                  ← Config interna del frontend
├── nginx/
│   ├── nginx.conf                  ← ⭐ Reverse proxy principal (SSL)
│   └── nginx-init.conf            ← Config temporal HTTP (bootstrapping)
├── scripts/
│   └── setup-vps.sh                ← Script de setup inicial del VPS
├── docker-compose.prod.yml         ← ⭐ Orquestación de producción
├── .env.prod.example               ← Template de variables de entorno
└── .gitignore                      ← Excluye .env.prod, certbot/, etc.
```

---

## 🔧 Dockerfiles — Build Multi-Stage

### Backend

```mermaid
graph LR
    subgraph Stage1["Stage 1: Builder"]
        S1A["Node 20 Alpine"]
        S1B["+ python3, make, g++\n+ cairo, pango, jpeg\n(para canvas & bcrypt)"]
        S1C["npm ci"]
        S1D["npm run build (tsc)"]
    end

    subgraph Stage2["Stage 2: Production"]
        S2A["Node 20 Alpine (limpio)"]
        S2B["+ cairo, pango runtime"]
        S2C["npm ci --omit=dev"]
        S2D["COPY dist/ migrations/ scripts/"]
        S2E["CMD node dist/app.js"]
    end

    Stage1 -->|"COPY --from=builder"| Stage2

    style Stage1 fill:#fff3e0
    style Stage2 fill:#e8f5e9
```

### Frontend

```mermaid
graph LR
    subgraph Stage1["Stage 1: Builder"]
        F1A["Node 20 Alpine"]
        F1B["npm ci"]
        F1C["VITE_API_URL como ARG"]
        F1D["npx vite build"]
    end

    subgraph Stage2["Stage 2: Serve"]
        F2A["Nginx Alpine"]
        F2B["COPY dist/ → /usr/share/nginx/html"]
        F2C["SPA routing config"]
        F2D["CMD nginx"]
    end

    Stage1 -->|"COPY --from=builder"| Stage2

    style Stage1 fill:#fff3e0
    style Stage2 fill:#e3f2fd
```

---

## 🔀 Nginx — Configuración

```mermaid
graph TB
    subgraph HTTP[":80 — HTTP"]
        ACME["/.well-known/acme-challenge/\n→ /var/www/certbot"]
        REDIR["Todo lo demás\n→ 301 HTTPS"]
    end

    subgraph HTTPS1[":443 — api.cuspia.com"]
        API_RL["Rate limit: 30 req/s\nburst 50"]
        API_PROXY["/ → backend:3000"]
        WS["WebSocket\n/socket.io/ → backend:3000\nUpgrade connection"]
    end

    subgraph HTTPS2[":443 — *.cuspia.com"]
        FE_PROXY["/ → frontend:80\nSPA routing"]
    end

    style HTTP fill:#ffebee
    style HTTPS1 fill:#e3f2fd
    style HTTPS2 fill:#e8f5e9
```

| Función | Configuración |
|---|---|
| **Rate limiting** | 30 req/s por IP (burst 50) solo en API |
| **Max body size** | 50MB (para uploads de radiografías) |
| **WebSocket** | Proxy con upgrade en `/socket.io/` |
| **SSL** | TLS 1.2 + 1.3, ciphers HIGH |
| **Timeout** | WebSocket: 86400s (24h keepalive) |

---

## 🖥️ Servidor VPS

| Aspecto | Valor |
|---|---|
| **Proveedor** | Hetzner Cloud |
| **Plan** | CAX21 (4 vCPU ARM64, 8 GB RAM, 80 GB SSD) |
| **Ubicación** | Nuremberg, Alemania |
| **OS** | Ubuntu 24.04 |
| **IP** | `46.225.137.160` |
| **Backups** | Habilitados (Hetzner automáticos) |
| **Firewall** | UFW (SSH: 22, HTTP: 80, HTTPS: 443) |
| **Proyecto** | `/opt/cuspia` |
| **Acceso** | `ssh root@46.225.137.160` |

---

## ⚙️ Variables de Entorno (Producción)

El archivo `.env.prod` vive en el VPS en `/opt/cuspia/.env.prod` y **nunca se sube a Git**.

Usa `.env.prod.example` como template:

| Variable | Ejemplo | Descripción |
|---|---|---|
| `DB_USER` | `cuspia` | Usuario PostgreSQL |
| `DB_PASSWORD` | `***` | Contraseña PostgreSQL |
| `REDIS_PASSWORD` | `***` | Contraseña Redis |
| `MINIO_USER` | `minioadmin` | Usuario MinIO |
| `MINIO_PASSWORD` | `***` | Contraseña MinIO |
| `JWT_ACCESS_SECRET` | `***` | Secret para access tokens |
| `JWT_REFRESH_SECRET` | `***` | Secret para refresh tokens |
| `FRONTEND_URL` | `https://app.cuspia.com` | URL del frontend |
| `VITE_API_URL` | `https://api.cuspia.com` | URL del API (build-time) |
| `SMTP_HOST` | `smtp.hostinger.com` | Servidor SMTP |
| `OPENAI_API_KEY` | `sk-***` | API key de OpenAI |

---

## 📋 Operaciones Comunes

### Ver estado de los contenedores
```bash
ssh root@46.225.137.160
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

### Ver logs del backend
```bash
docker logs cuspia_backend --tail 100 -f
```

### Reiniciar un servicio
```bash
docker compose -f docker-compose.prod.yml restart backend
```

### Ejecutar migraciones
```bash
docker exec cuspia_backend node -e "
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
migrate(db, { migrationsFolder: './migrations' })
  .then(() => { console.log('Done'); pool.end(); })
  .catch(e => { console.error(e); pool.end(); });
"
```

### Provisionar un nuevo tenant
```bash
docker exec -it cuspia_backend npx tsx src/scripts/provision-tenant.ts -- \
  --name "Nombre Empresa" \
  --slug "nombre-empresa" \
  --admin-email "admin@empresa.com" \
  --admin-password "SecurePass123!" \
  --admin-first "Nombre" \
  --admin-last "Apellido" \
  --org-name "Empresa S.L." \
  --db-host cuspia_db \
  --db-password TU_DB_PASSWORD
```

### Backup manual de la base de datos
```bash
# Backup de un tenant
docker exec cuspia_db pg_dump -U cuspia dental_erp > backup_$(date +%Y%m%d).sql

# Backup de la DB central
docker exec cuspia_central_db pg_dump -U cuspia cuspia_central > backup_central_$(date +%Y%m%d).sql
```

### Restaurar un backup
```bash
cat backup.sql | docker exec -i cuspia_db psql -U cuspia dental_erp
```

---

## 🚨 Troubleshooting

| Problema | Diagnóstico | Solución |
|---|---|---|
| Backend en restart loop | `docker logs cuspia_backend` | Revisar env vars (ej: `AI_SERVICE_URL` vacío) |
| Error SSL en nuevo subdominio | El cert no incluye ese subdominio | Re-emitir cert con `--expand` (ver sección SSL) |
| `tenants table does not exist` | Falta schema en central DB | Ejecutar `npm run central:push` dentro del container |
| Frontend muestra página en blanco | Build con API URL incorrecta | Verificar `VITE_API_URL` y rebuild frontend |
| WebSocket desconectado | Nginx no proxea `/socket.io/` | Verificar config nginx upstream |
| Puerto 80/443 no responde | Firewall o Nginx caído | `ufw status` y `docker start cuspia_nginx` |

---

## 🔄 Flujo Completo: Setup desde Cero

```mermaid
graph TD
    A["1️⃣ Crear VPS en Hetzner\n(CAX21, Ubuntu 24.04)"] --> B
    B["2️⃣ Ejecutar setup-vps.sh\n(Docker, UFW, Git)"] --> C
    C["3️⃣ Configurar DNS en Hostinger\n(@, api, *, A → IP)"] --> D
    D["4️⃣ Clonar repo en /opt/cuspia\n(git clone)"] --> E
    E["5️⃣ Crear .env.prod\n(copiar .env.prod.example)"] --> F
    F["6️⃣ Build y levantar contenedores\n(docker compose up -d --build)"] --> G
    G["7️⃣ Obtener SSL\n(certbot standalone)"] --> H
    H["8️⃣ Activar nginx SSL\n(copiar nginx-ssl.conf)"] --> I
    I["9️⃣ Crear tablas central DB\n(central:push)"] --> J
    J["🔟 Crear SUPERADMIN\n(provision --create-superadmin)"] --> K
    K["✅ ¡Sistema listo!\nadmin.cuspia.com"]

    style A fill:#e3f2fd
    style K fill:#e8f5e9
```

---

*Última actualización: 15 de Febrero de 2026*
