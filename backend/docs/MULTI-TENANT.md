# 🏢 Guía Multi-Tenant — Cuspia

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

1. Crea una nueva base de datos PostgreSQL
2. Crea todas las tablas en esa base de datos
3. Mete los datos iniciales (seed)
4. Registra la empresa en la DB central
5. Crea el usuario administrador de esa empresa
6. Registra al admin en `global_users` para que pueda hacer login

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
# Abre http://localhost:4983 en tu navegador
```

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
# Prueba login con admin, worker y superadmin
```

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

## 🧑‍💼 Tipos de Usuarios

| Rol | Dónde vive | Qué puede hacer |
|---|---|---|
| **SUPERADMIN** | DB Central (`superadmins`) | Ver todas las empresas, gestionar la plataforma |
| **ADMIN** | DB del Tenant (`users`) | Gestionar su empresa, clínicas, empleados |
| **WORKER** | DB del Tenant (`users`) | Trabajar en las clínicas asignadas |
| **USER** (Paciente) | DB del Tenant (`users`) | Ver sus citas, historial |

> **💡 Nota**: El SUPERADMIN es el único que NO está en ninguna DB de tenant. Es un rol de plataforma que solo existe en la DB central.

---

## ❓ Preguntas Frecuentes

### ¿Qué pasa si un profesional trabaja en 2 empresas?
Funcionará automáticamente. Cuando haga login, verá un selector de empresa preguntándole "¿A cuál quieres acceder?".

### ¿Los datos de una empresa pueden ver los de otra?
No. Cada empresa tiene su propia base de datos completamente separada. Es imposible que se mezclen.

### ¿Puedo borrar una empresa?
De momento no hay un comando para borrar, pero puedes desactivarla desde la DB central poniendo `is_active = false` en la tabla `tenants`.

### ¿Qué nombre de DB se crea para cada empresa?
Se genera automáticamente: `cuspia_` + el slug con guiones reemplazados por underscores. Ejemplo: slug `vitaldent` → DB `cuspia_vitaldent`.
