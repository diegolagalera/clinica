# 🌐 Subdominios por Tenant — Cuspia

> **Requisito**: Ya tienes el sistema multi-tenant funcionando (ver [MULTI-TENANT.md](./MULTI-TENANT.md))

## ¿Cómo funciona?

Cada empresa (tenant) tiene su **propio subdominio**. La URL determina automáticamente a qué empresa accede el usuario:

| Subdominio | URL | ¿Quién accede? |
|---|---|---|
| `mi-clinica` | `mi-clinica.cuspia.com` | Admin, Workers y Pacientes de "Mi Clínica" |
| `vitaldent` | `vitaldent.cuspia.com` | Admin, Workers y Pacientes de "Vitaldent" |
| `admin` | `admin.cuspia.com` | SuperAdmin (gestión de plataforma) |
| _(ninguno)_ | `cuspia.com` | Landing page / marketing |

### Ventajas vs selector de empresa
- **Sin pasos extra al hacer login**: el usuario entra directamente a su empresa
- **URLs compartibles**: un admin puede enviar `mi-clinica.cuspia.com` a su equipo
- **Aislamiento visual**: cada empresa ve solo su contexto
- **SuperAdmin claro**: `admin.cuspia.com` es exclusivo para gestión

---

## 🛠 Setup para Desarrollo Local

### 1. Modificar `/etc/hosts`

Añade entradas para los subdominios que necesites probar:

```bash
sudo nano /etc/hosts
```

Añade al final:
```
# Cuspia - subdominios locales
127.0.0.1  mi-clinica.localhost
127.0.0.1  admin.localhost
```

> **💡 Tip**: Añade una línea por cada tenant que provisionas. El slug del tenant = el subdominio.

### 2. Vite ya está configurado

`vite.config.ts` tiene `server.host: true`, lo que permite que el dev server acepte conexiones desde `*.localhost`.

### 3. Acceder

| URL | Qué verás |
|---|---|
| `http://mi-clinica.localhost:5173` | Login de "Mi Clínica" (con nombre de empresa) |
| `http://admin.localhost:5173` | Login de SuperAdmin |
| `http://localhost:5173` | Login genérico (sin contexto de tenant) |

---

## 🔄 Flujo de Autenticación

```
Usuario visita mi-clinica.localhost:5173
        │
        ▼
┌─────────────────────────┐
│  Frontend (tenant.ts)   │
│  Extrae slug del host:  │
│  "mi-clinica"           │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  api.ts (interceptor)   │
│  Inyecta header:        │
│  X-Tenant-Slug:         │
│    mi-clinica            │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Backend (auth.service) │
│  Lee X-Tenant-Slug →    │
│  Conecta a tenant DB →  │
│  Verifica credenciales  │
└─────────────────────────┘
```

### SuperAdmin (admin.localhost)

Cuando el subdominio es `admin`:
- `getTenantSlug()` devuelve `null`
- No se envía `X-Tenant-Slug`
- El backend busca en la tabla `superadmins` de la DB central

### Subdominio inexistente

Si alguien entra a `empresa-falsa.localhost:5173`:
- La página de login intenta verificar el tenant via `GET /tenants/empresa-falsa/info`
- Si no existe, muestra una pantalla de error con enlace a `cuspia.com`

---

## 🧩 Archivos Clave

### Frontend

| Archivo | Función |
|---|---|
| `src/utils/tenant.ts` | Extrae el slug del hostname. Identifica dominios reservados (`admin`, `www`, `api`) |
| `src/services/api.ts` | Interceptor que inyecta `X-Tenant-Slug` en cada request |
| `src/pages/auth/Login.vue` | Muestra nombre del tenant, pantalla de error si no existe |

### Backend

| Archivo | Función |
|---|---|
| `src/services/auth.service.ts` | `login()` usa el slug del header para ir directo al tenant DB |
| `src/controllers/auth.controller.ts` | Lee `X-Tenant-Slug` del header en login, forgot-password, reset-password |
| `src/routes/index.ts` | Endpoint público `GET /tenants/:slug/info` (sin auth) |

---

## 📌 Subdominios Reservados

Estos subdominios **no** son tenants y tienen comportamiento especial:

| Subdominio | Uso |
|---|---|
| `admin` | Panel SuperAdmin |
| `www` | Redirección al dominio principal |
| `api` | Reservado para endpoints API |
| `app` | Reservado para uso futuro |

Se definen en `frontend/src/utils/tenant.ts` → `RESERVED_SUBDOMAINS`.

---

## 🚀 Producción

### DNS
Configurar un **wildcard DNS** que apunte `*.cuspia.com` al servidor:
```
*.cuspia.com  →  A  →  IP_DEL_SERVIDOR
cuspia.com    →  A  →  IP_DEL_SERVIDOR
```

### SSL
Obtener un **certificado wildcard** con Let's Encrypt:
```bash
certbot certonly --dns-cloudflare \
  -d cuspia.com \
  -d *.cuspia.com
```

### Nginx
Configurar un bloque `server` que capture todos los subdominios:
```nginx
server {
    listen 443 ssl;
    server_name *.cuspia.com;

    ssl_certificate     /etc/letsencrypt/live/cuspia.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cuspia.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5173;  # Frontend
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;  # Backend
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## ❓ Preguntas Frecuentes

### ¿Cómo sabe el frontend a qué empresa conectar?
Extrae el subdominio de `window.location.hostname`. Si la URL es `mi-clinica.cuspia.com`, el slug es `mi-clinica`. Se envía como header `X-Tenant-Slug` en cada request al backend.

### ¿Qué pasa si un trabajador pertenece a 2 empresas?
Debe entrar por la URL de cada empresa por separado. Ejemplo: si trabaja en "Vitaldent" y "Clínica Madrid", accede a `vitaldent.cuspia.com` para una y `clinica-madrid.cuspia.com` para la otra.

### ¿Cómo añado un subdominio nuevo en local?
1. Provisiona el tenant: `npm run tenant:provision -- --name "X" --slug "x" ...`
2. Añade a `/etc/hosts`: `127.0.0.1  x.localhost`
3. Accede a `http://x.localhost:5173`

### ¿El slug del tenant es lo mismo que el subdominio?
Sí. El slug que se pasa en `--slug` al provisionar es exactamente el subdominio que se usará. Usa minúsculas y guiones: `clinica-dental`, `vitaldent`, etc.

### ¿Puedo cambiar el subdominio de una empresa?
No directamente. Tendrías que actualizar el `slug` en la tabla `tenants` de la DB central y renombrar el bucket MinIO. Es una operación manual.
