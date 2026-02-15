# 📊 CUSPIA — Estado del Servidor en Producción

> Última inspección: **15 de Febrero de 2026, 23:10 UTC**
> Servidor: `46.225.137.160` (Hetzner CAX21)

---

## 🖥️ Vista General

```mermaid
graph TB
    subgraph VPS["🖥️ Hetzner VPS — CAX21 (ARM64)"]
        direction TB
        subgraph Resources["📊 Recursos"]
            CPU["CPU: 4 vCPU ARM64"]
            RAM["RAM: 875 MB / 7.5 GB (11%)"]
            DISK["Disco: 6.9 GB / 75 GB (10%)"]
        end
    end

    style VPS fill:#1a1a2e,color:#fff
    style Resources fill:#16213e,color:#fff
```

---

## 🐳 Contenedores Docker

```mermaid
graph TB
    subgraph Running["🟢 Contenedores Activos (9)"]
        direction TB

        subgraph PublicLayer["🌐 Capa Pública"]
            NGINX["🔀 cuspia_nginx\nnginx:alpine · 92.6 MB\n:80 / :443 → Internet"]
        end

        subgraph AppLayer["📱 Capa de Aplicación"]
            BE["⚡ cuspia_backend\ncuspia-backend · 775 MB\n:3000 · ✅ Healthy"]
            FE["🖼️ cuspia_frontend\ncuspia-frontend · 96.8 MB\n:80 interno"]
        end

        subgraph DataLayer["🗄️ Capa de Datos"]
            PG["🐘 cuspia_db\npgvector:pg16 · 639 MB\n:5432 · ✅ Healthy\n87.71 MB datos"]
            CPG["🐘 cuspia_central_db\npostgres:16-alpine · 389 MB\n:5432 · ✅ Healthy\n48.37 MB datos"]
            RD["🔴 cuspia_redis\nredis:7-alpine · 61.9 MB\n:6379 · ✅ Healthy"]
            MN["📦 cuspia_minio\nminio · 228 MB\n:9000 / :9001 · ✅ Healthy"]
        end

        subgraph UtilLayer["🔧 Utilidades"]
            CB["🔒 cuspia_certbot\ncertbot · 295 MB\nSSL auto-renew"]
        end
    end

    NGINX --> BE
    NGINX --> FE
    BE --> PG
    BE --> CPG
    BE --> RD
    BE --> MN

    style PublicLayer fill:#2d1b38,color:#fff
    style AppLayer fill:#0d2137,color:#fff
    style DataLayer fill:#1b2838,color:#fff
    style UtilLayer fill:#2a1f1b,color:#fff
```

---

## 🗄️ Bases de Datos

```mermaid
graph LR
    subgraph PostgresMain["cuspia_db (pgvector:pg16)"]
        direction TB
        DB1["🗃️ dental_erp\n11 MB\n(DB original / default)"]
        DB2["🗃️ cuspia_empresa_test\n11 MB\n(Tenant: Empresa Test)"]
        DB3["🗃️ postgres\n7.5 MB\n(sistema)"]
    end

    subgraph PostgresCentral["cuspia_central_db (postgres:16)"]
        direction TB
        CDB["🗃️ cuspia_central\n7.3 MB"]
        T1["📋 superadmins"]
        T2["📋 tenants"]
        T3["📋 global_users"]
        CDB --- T1
        CDB --- T2
        CDB --- T3
    end

    subgraph Redis["cuspia_redis"]
        RD["🔴 Redis 7\n0 B datos\n(caché y sesiones)"]
    end

    style PostgresMain fill:#336791,color:#fff
    style PostgresCentral fill:#2d6b4f,color:#fff
    style Redis fill:#dc382c,color:#fff
```

### Tenants Registrados

| Empresa | Slug | Plan | Estado | DB | Creado |
|---|---|---|---|---|---|
| Empresa Test | `empresa-test` | basic | ✅ Activo | `cuspia_empresa_test` | 15/02/2026 |

---

## 📦 MinIO (Almacenamiento S3)

```mermaid
graph LR
    subgraph MinIO["📦 MinIO — Almacenamiento de Archivos"]
        B1["🪣 cuspia\n(bucket default)"]
        B2["🪣 cuspia-empresa-test\n(Tenant: Empresa Test)"]
    end

    B1 --- F1["📷 Radiografías\n📄 Documentos"]
    B2 --- F2["📷 Radiografías\n💬 Media WhatsApp\n📦 Imágenes stock"]

    style MinIO fill:#c62828,color:#fff
```

---

## 💾 Volúmenes Docker (Persistencia)

```mermaid
graph TB
    subgraph Volumes["📁 Volúmenes Docker"]
        V1["cuspia_postgres_data\n87.71 MB\n→ cuspia_db"]
        V2["cuspia_postgres_central_data\n48.37 MB\n→ cuspia_central_db"]
        V3["cuspia_redis_data\n0 B\n→ cuspia_redis"]
        V4["cuspia_minio_data\n28.73 KB\n→ cuspia_minio"]
    end

    style Volumes fill:#1b4332,color:#fff
```

| Volumen | Tamaño | Contenedor |
|---|---|---|
| `cuspia_postgres_data` | 87.71 MB | cuspia_db |
| `cuspia_postgres_central_data` | 48.37 MB | cuspia_central_db |
| `cuspia_redis_data` | 0 B | cuspia_redis |
| `cuspia_minio_data` | 28.73 KB | cuspia_minio |

---

## ⚡ Imágenes Docker

| Imagen | Tamaño | Tipo |
|---|---|---|
| `cuspia-backend` | 775 MB | Custom (Node 20 multi-stage) |
| `pgvector/pgvector:pg16` | 639 MB | Oficial |
| `postgres:16-alpine` | 389 MB | Oficial |
| `certbot/certbot` | 295 MB | Oficial |
| `minio/minio` | 228 MB | Oficial |
| `minio/mc` | 112 MB | Oficial |
| `cuspia-frontend` | 96.8 MB | Custom (Vite + Nginx) |
| `nginx:alpine` | 92.6 MB | Oficial |
| `redis:7-alpine` | 61.9 MB | Oficial |

---

## 🔒 Seguridad

```mermaid
graph LR
    subgraph Firewall["🛡️ UFW Firewall"]
        R1["✅ SSH :22"]
        R2["✅ HTTP :80"]
        R3["✅ HTTPS :443"]
        R4["❌ Todo lo demás"]
    end

    subgraph SSL["🔒 SSL/TLS"]
        CERT["📜 Wildcard Cert\n*.cuspia.com\nExpira: 16/05/2026"]
        RENEW["♻️ Auto-renovación\nCron diario 3:00 AM"]
    end

    subgraph Secrets["🔑 Secrets"]
        S1["🔐 /opt/cuspia/.env.prod\nDB, Redis, JWT, SMTP..."]
        S2["🔐 /root/.secrets/cloudflare.ini\nAPI Token DNS"]
    end

    style Firewall fill:#b71c1c,color:#fff
    style SSL fill:#1b5e20,color:#fff
    style Secrets fill:#4a148c,color:#fff
```

---

## 🔄 Tareas Programadas (Cron)

| Hora | Tarea | Log |
|---|---|---|
| 03:00 AM diario | Renovación SSL (Certbot + Cloudflare) | `/var/log/certbot-renew.log` |
| 02:00 AM diario | 🆕 Backup DBs (ver sección siguiente) | `/var/log/cuspia-backup.log` |

---

## 💾 Copias de Seguridad

```mermaid
graph LR
    subgraph Backup["💾 Sistema de Backups"]
        CRON["⏰ Cron\n02:00 AM diario"]
        SCRIPT["📜 backup.sh"]
        LOCAL["📁 /opt/cuspia/backups/\n(últimos 7 días)"]
    end

    subgraph Targets["🎯 Qué se respalda"]
        T1["🐘 cuspia_central\n(superadmins, tenants,\nglobal_users)"]
        T2["🐘 dental_erp\n(DB default)"]
        T3["🐘 cuspia_*\n(todas las DBs de tenants)"]
        T4["📦 MinIO\n(archivos de todos los buckets)"]
    end

    CRON --> SCRIPT
    SCRIPT --> LOCAL
    T1 --> SCRIPT
    T2 --> SCRIPT
    T3 --> SCRIPT
    T4 --> SCRIPT

    style Backup fill:#0d47a1,color:#fff
    style Targets fill:#1b5e20,color:#fff
```

### Política de retención
- **Local**: últimos 7 días en `/opt/cuspia/backups/`
- **Nombres**: `central_2026-02-15.sql.gz`, `tenant_empresa-test_2026-02-15.sql.gz`, etc.
- **Frecuencia**: diaria a las 02:00 AM

---

## 🗺️ Mapa Completo de Red

```mermaid
graph TB
    USER["👤 Usuario"] -->|HTTPS| CF["☁️ Cloudflare DNS"]
    CF -->|DNS only| VPS["🖥️ VPS 46.225.137.160"]

    subgraph VPS_INTERNAL["Docker Network: internal"]
        NGINX["🔀 nginx\n:80/:443"]
        BE["⚡ backend\n:3000"]
        FE["🖼️ frontend\n:80"]
        PG["🐘 postgres\n:5432"]
        CPG["🐘 central_db\n:5432"]
        RD["🔴 redis\n:6379"]
        MN["📦 minio\n:9000"]
    end

    VPS --> NGINX
    NGINX -->|api.cuspia.com| BE
    NGINX -->|*.cuspia.com| FE
    BE --> PG
    BE --> CPG
    BE --> RD
    BE --> MN

    GH["⚙️ GitHub Actions"] -->|SSH deploy| VPS

    style VPS_INTERNAL fill:#0d1b2a,color:#fff
    style CF fill:#f48c06,color:#000
```

---

*Para actualizar este documento, ejecuta el script de inspección del servidor y actualiza los datos.*
