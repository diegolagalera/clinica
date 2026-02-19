# 🏢 Guía Multi-Tenant — Cuspia

> **Stack**: drizzle-orm 0.45.x · drizzle-kit 0.31.x · PostgreSQL 16 · Node.js 20+

## ¿Qué es Multi-Tenant?

Imagina que Cuspia es como un edificio de oficinas:
- **Antes**: Solo había 1 oficina (1 base de datos) para 1 empresa
- **Ahora**: Hay muchas oficinas (cada empresa tiene su propia base de datos), y un **portero** (la DB central) que sabe a qué oficina dirigir a cada persona

Cada "tenant" = una empresa/clínica que usa Cuspia con su propia base de datos aislada.

---

## 📋 Resumen de Comandos

| Comando | ¿Cuándo usarlo? | ¿Se ejecuta una vez o muchas? |
|---|---|---|
| `npm run central:push` | Al instalar por primera vez | **Una vez** |
| `npm run tenant:migrate` | Al convertir tu instalación actual a multi-tenant | **Una vez** |
| `npm run tenant:provision` | Cada vez que un nuevo cliente contrate Cuspia | **Muchas veces** |
| `npm run tenant:migrate-all` | Tras cambiar el schema (nuevas tablas/columnas) | **Muchas veces** |
| `npm run tenant:cleanup` | Para eliminar un tenant | Cuando quieras |
| `npm run central:studio` | Para inspeccionar la DB central (debug) | Cuando quieras |

---

## 1️⃣ `npm run central:push`

### ¿Qué hace?
Crea las tablas en la base de datos central (`cuspia_central`). Es como "preparar el portero" — sin esto, nada funciona.

### ¿Cuándo usarlo?
**Solo una vez**, cuando montas el sistema por primera vez (o cuando reseteas la DB central).

### Requisitos previos
- Docker debe estar corriendo (`docker compose up -d`)
- `CENTRAL_DATABASE_URL` debe estar en tu `.env`

### Ejemplo
```bash
npm run central:push
# Te preguntará si quieres ejecutar las sentencias SQL → di "Yes"
```

### Tablas que crea
| Tabla | Para qué sirve |
|---|---|
| `tenants` | Registro de cada empresa (nombre, slug, URL de su DB) |
| `global_users` | Índice de qué usuarios están en qué empresa |
| `superadmins` | Administradores de plataforma (tú) |

---

## 2️⃣ `npm run tenant:migrate`

### ¿Qué hace?
Convierte tu instalación actual (single-tenant) a multi-tenant. Concretamente:

1. Registra tu base de datos actual como un "tenant" en la DB central
2. Copia los emails de tus usuarios existentes a `global_users` (para que el login los encuentre)
3. Opcionalmente crea un SUPERADMIN

### ¿Cuándo usarlo?
**Solo una vez**, después de `central:push`. Es el paso de "migración" para que tus datos actuales sigan funcionando con el nuevo sistema.

### Ejemplo básico
```bash
npm run tenant:migrate -- \
  --tenant-name "Mi Clínica" \
  --tenant-slug "mi-clinica"
```

### Ejemplo completo (con SUPERADMIN)
```bash
npm run tenant:migrate -- \
  --tenant-name "Mi Clínica" \
  --tenant-slug "mi-clinica" \
  --sa-email "superadmin@cuspia.com" \
  --sa-password "MiPasswordSegura123!"
```

### Parámetros

| Parámetro | Obligatorio | Descripción |
|---|---|---|
| `--tenant-name` | No (default: "Mi Clínica") | Nombre visible de la empresa |
| `--tenant-slug` | No (default: "default") | Identificador único (sin espacios ni acentos) |
| `--sa-email` | No | Email del superadmin a crear |
| `--sa-password` | No | Contraseña del superadmin |

> **⚠️ IMPORTANTE**: El `--tenant-slug` debe ser único. Usa algo como el nombre de la empresa en minúsculas con guiones: `clinica-madrid`, `vitaldent`, etc.

---

## 3️⃣ `npm run tenant:provision`

### ¿Qué hace?
Crea una empresa nueva desde cero. Es el comando que usarás **cada vez que un nuevo cliente contrate Cuspia**. Hace todo automáticamente:

1. Registra la empresa en la DB central
2. **Verifica que el bucket S3 compartido existe** (`cuspia` / `cuspia-develop`)
3. Crea una nueva base de datos PostgreSQL
4. Crea todas las tablas en esa base de datos
5. Mete los datos iniciales (seed)
6. Crea el usuario administrador de esa empresa
7. Registra al admin en `global_users` para que pueda hacer login

### ¿Cuándo usarlo?
**Cada vez que quieras dar de alta una empresa nueva.**

### Ejemplo: Crear una empresa nueva
```bash
npm run tenant:provision -- \
  --name "Vitaldent" \
  --slug "vitaldent" \
  --admin-email "carlos@vitaldent.com" \
  --admin-password "SecurePass123!" \
  --admin-first "Carlos" \
  --admin-last "García" \
  --org-name "Vitaldent S.L."
```

### Ejemplo: Con clínica incluida
```bash
npm run tenant:provision -- \
  --name "Vitaldent" \
  --slug "vitaldent" \
  --admin-email "carlos@vitaldent.com" \
  --admin-password "SecurePass123!" \
  --admin-first "Carlos" \
  --admin-last "García" \
  --org-name "Vitaldent S.L." \
  --clinic-name "Vitaldent Centro" \
  --plan "premium" \
  --max-clinics 10
```

### Ejemplo: Crear un SUPERADMIN
```bash
npm run tenant:provision -- --create-superadmin \
  --admin-email "superadmin@cuspia.com" \
  --admin-password "password123" \
  --admin-first "Super" \
  --admin-last "Admin"
```

### Parámetros para crear empresa

| Parámetro | Obligatorio | Descripción | Ejemplo |
|---|---|---|---|
| `--name` | ✅ | Nombre de la empresa | "Vitaldent" |
| `--slug` | ✅ | ID único (minúsculas, guiones) | "vitaldent" |
| `--admin-email` | ✅ | Email del admin | "admin@vitaldent.com" |
| `--admin-password` | ✅ | Contraseña del admin | "SecurePass123!" |
| `--admin-first` | ✅ | Nombre del admin | "Carlos" |
| `--admin-last` | ✅ | Apellido del admin | "García" |
| `--org-name` | ✅ | Nombre de la organización | "Vitaldent S.L." |
| `--clinic-name` | No | Nombre de la primera clínica | "Sede Centro" |
| `--plan` | No (default: "basic") | Plan contratado | "premium" |
| `--max-clinics` | No (default: 5) | Máximo de clínicas | 10 |
| `--db-host` | No (default: "localhost") | Host de PostgreSQL | "db.example.com" |
| `--db-port` | No (default: "5432") | Puerto de PostgreSQL | 5432 |
| `--db-user` | No (default: "postgres") | Usuario de PostgreSQL | "postgres" |
| `--db-password` | No (default: "postgres") | Contraseña de PostgreSQL | "mi_pass" |

---

## 4️⃣ `npm run central:studio`

### ¿Qué hace?
Abre Drizzle Studio, una interfaz web para ver y editar los datos de la DB central.

### ¿Cuándo usarlo?
Cuando quieras inspeccionar qué tenants hay registrados, qué usuarios globales hay, etc.

```bash
npm run central:studio
# Abre https://local.drizzle.studio en tu navegador
```

> **💡 Nota**: También puedes ver las tablas de un tenant específico con:
> ```bash
> npm run db:studio
> ```

---

## 5️⃣ Migrar Schema a Todos los Tenants

### ¿Qué hace?
Aplica las migraciones de Drizzle pendientes a **todas** las bases de datos de tenants activos. Es necesario ejecutarlo cada vez que se modifican tablas/columnas en `schema.ts`.

### ¿Cuándo usarlo?
**Cada vez que cambies el schema** (nueva tabla, nueva columna, cambio de tipo, etc.).

### Flujo completo
```bash
# 1. Editas src/db/schema.ts
# 2. Generas la migración
npx drizzle-kit generate

# 3. Aplicas a TODOS los tenants
npx tsx src/scripts/migrate-all-tenants.ts
```

### Opciones
| Flag | Descripción | Ejemplo |
|---|---|---|
| `--slug` | Migrar solo un tenant específico | `--slug vitaldent` |
| `--dry-run` | Ver qué tenants se migrarían, sin tocar nada | `--dry-run` |

### Ejemplo: Migrar solo un tenant
```bash
npx tsx src/scripts/migrate-all-tenants.ts --slug vitaldent
```

> **💡 Nota**: Los tenants **nuevos** creados con `tenant:provision` ya reciben el schema completo automáticamente. Este script solo es necesario para tenants que **ya existían** antes del cambio.

---

## 6️⃣ Limpiar/Eliminar un Tenant

Si necesitas eliminar un tenant (provisioning fallido, datos de prueba, etc.):

```bash
npx tsx src/scripts/cleanup-tenant.ts --slug nombre-empresa
```

Esto elimina:
1. El registro del tenant en la DB central
2. Sus entradas en `global_users`
3. Todos los **archivos del tenant en S3** (por prefijo `{slug}/`)
4. La **base de datos** del tenant

---

## 7️⃣ Almacenamiento de Archivos (Hetzner Object Storage)

### Estrategia: Bucket Único con Prefijos por Tenant

Todos los tenants comparten un solo bucket S3 (`cuspia`), con aislamiento por prefijo de key:

| Empresa | Slug | Prefijo S3 |
|---|---|---|
| Vitaldent | `vitaldent` | `cuspia/vitaldent/...` |
| Clínica Madrid | `clinica-madrid` | `cuspia/clinica-madrid/...` |

### ¿Qué se almacena?
- 📷 **Radiografías** y análisis AI
- 📦 **Imágenes de stock** (productos)
- 💬 **Media de WhatsApp** (fotos, audios, documentos)
- ✍️ **Documentos firmados** (e-signature)

### Formato del Key
```
{tenantSlug}/{clinicId}/{category}/{filename}
```
Ejemplo: `vitaldent/762c742d-.../radiographs/foto.jpg`

### ¿Cómo se resuelve el tenant?
| Contexto | Método |
|---|---|
| Rutas autenticadas (radiografías, stock, chat) | JWT → `tenantSlug` → prefijo en key |
| Webhook de WhatsApp (Meta) | Reverse lookup → `tenantSlug` |
| Ruta de media `/api/v1/media/*` | Query param `?t=slug` o JWT |

### Ciclo de vida
- **El bucket se crea una vez** (manualmente o en primer provisioning)
- **Los archivos del tenant se crean automáticamente** con el prefijo `{slug}/`
- **Al eliminar un tenant**, se borran todos los objetos con prefijo `{slug}/`

---

## 🔄 Flujo Completo: Desde Cero

### Paso 1: Levantar infraestructura
```bash
docker compose up -d
```

### Paso 2: Crear tablas de la DB central
```bash
npm run central:push
```

### Paso 3: Migrar datos actuales
```bash
npm run tenant:migrate -- \
  --tenant-name "Mi Clínica" \
  --tenant-slug "mi-clinica" \
  --sa-email "superadmin@cuspia.com" \
  --sa-password "password123"
```

### Paso 4: Verificar que todo funciona
```bash
npm run dev
# Accede vía subdomain: http://mi-clinica.localhost:5173
# SuperAdmin: http://admin.localhost:5173
```

> **💡 Nota**: Necesitas añadir entradas en `/etc/hosts` para subdominios locales. Consulta la guía [SUBDOMAIN-TENANCY.md](./SUBDOMAIN-TENANCY.md) para más detalles.

### Paso 5 (futuro): Alta de nueva empresa
```bash
npm run tenant:provision -- \
  --name "Nueva Empresa" \
  --slug "nueva-empresa" \
  --admin-email "admin@nueva.com" \
  --admin-password "Pass123!" \
  --admin-first "Juan" \
  --admin-last "Pérez" \
  --org-name "Nueva Empresa S.L."
```

---

### 🔄 Sincronizar usuarios a la DB central

Cuando se crean usuarios desde el panel de admin (Gestión de Personal), se registran automáticamente en `global_users` (DB central) para que el login multi-tenant funcione. Sin embargo, si necesitas re-sincronizar manualmente (por ejemplo, tras una migración o si sospechas que faltan usuarios):

```bash
npx tsx src/scripts/sync-global-users.ts
```

Este script:
- Recorre **todos los tenants activos**
- Compara los usuarios de cada tenant con `global_users`
- Inserta los que falten (sin duplicar los que ya existen)
- Excluye SUPERADMINs (viven en la tabla `superadmins`, no en `global_users`)

> **💡 Nota**: Este comando es idempotente — puedes ejecutarlo varias veces sin riesgo.

---

## 🧑‍💼 Tipos de Usuarios

| Rol | Dónde vive | Qué puede hacer |
|---|---|---|
| **SUPERADMIN** | DB Central (`superadmins`) | Ver todas las empresas, gestionar la plataforma |
| **ADMIN** | DB del Tenant (`users`) + `global_users` | Gestionar su empresa, clínicas, empleados |
| **WORKER** | DB del Tenant (`users`) + `global_users` | Trabajar en las clínicas asignadas |
| **USER** (Paciente) | DB del Tenant (`users`) + `global_users` | Ver sus citas, historial |

> **💡 Nota**: El SUPERADMIN es el único que NO está en `global_users`. Es un rol de plataforma que solo existe en la DB central (tabla `superadmins`).
> 
> Todos los demás roles se registran en `global_users` al ser creados, lo que permite el routing de login multi-tenant.

---

## ❓ Preguntas Frecuentes

### ¿Qué pasa si un profesional trabaja en 2 empresas?
Cada empresa tiene un subdominio propio (ej: `empresa-a.cuspia.com` y `empresa-b.cuspia.com`). El profesional debe entrar por el subdominio de la empresa a la que quiere acceder. No hay selector de empresas — la URL determina a qué empresa va.

> **📌 Para más detalles sobre subdominios**, consulta [SUBDOMAIN-TENANCY.md](./SUBDOMAIN-TENANCY.md).

### ¿Los datos de una empresa pueden ver los de otra?
No. Cada empresa tiene su propia base de datos completamente separada. Es imposible que se mezclen.

### ¿Puedo borrar una empresa?
Sí, con el comando de cleanup:
```bash
npx tsx src/scripts/cleanup-tenant.ts --slug "nombre-empresa"
```
Esto elimina: DB central → `global_users` → datos S3 del tenant → base de datos.

### ¿Qué nombre de DB se crea para cada empresa?
Se genera automáticamente: `cuspia_` + el slug con guiones reemplazados por underscores. Ejemplo: slug `vitaldent` → DB `cuspia_vitaldent`.

### Si añado una nueva tabla/columna, ¿se actualiza en todas las empresas?
No es automático. Debes generar la migración y aplicarla:
```bash
npx drizzle-kit generate
npx tsx src/scripts/migrate-all-tenants.ts
```

### ¿Dónde se guardan los archivos de cada empresa?
Todos los archivos se guardan en un **bucket S3 compartido** (`cuspia`) en Hetzner Object Storage. Cada empresa tiene su propio prefijo: `{slug}/`. Al eliminar una empresa, se borran todos los objetos con ese prefijo.
```
