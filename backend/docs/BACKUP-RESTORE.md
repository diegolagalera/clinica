# 🗄️ Guía de Backup y Restauración — CUSPIA-ERP

## Índice
- [Sistema de backups automáticos](#sistema-de-backups-automáticos)
- [Estructura de archivos](#estructura-de-archivos)
- [Hacer un backup manual](#hacer-un-backup-manual)
- [Restaurar una base de datos](#restaurar-una-base-de-datos)
- [Restaurar TODAS las bases de datos](#restaurar-todas-las-bases-de-datos)
- [Verificar un backup](#verificar-un-backup)
- [Escenarios de emergencia](#escenarios-de-emergencia)
- [Configuración](#configuración)

---

## Sistema de backups automáticos

El sistema realiza backups automáticos diarios de **todas** las bases de datos:

| Parámetro | Valor |
|---|---|
| **Frecuencia** | Diaria a las 02:00 AM (UTC) |
| **Retención** | 15 días |
| **Ubicación** | `/opt/cuspia/backups/` |
| **Formato** | SQL comprimido con gzip (`.sql.gz`) |
| **Contenedor** | `cuspia_db` (PostgreSQL 16) |
| **Script** | `/opt/cuspia/scripts/backup.sh` |

### Bases de datos incluidas
- `cuspia_central` — Tabla de tenants, superadmins y usuarios globales
- `cuspia_empresa_test` — Base de datos del tenant "Empresa Test"
- `dental_erp` — Base de datos por defecto (sin uso activo)
- *(futuros tenants se incluyen automáticamente)*

---

## Estructura de archivos

```
/opt/cuspia/backups/
├── 2026-02-14/
│   ├── cuspia_central_0200.sql.gz
│   ├── cuspia_empresa_test_0200.sql.gz
│   └── dental_erp_0200.sql.gz
├── 2026-02-15/
│   ├── cuspia_central_0200.sql.gz
│   ├── cuspia_empresa_test_0200.sql.gz
│   └── dental_erp_0200.sql.gz
├── 2026-02-16/
│   └── ...
```

Cada carpeta corresponde a un día. Los backups se eliminan automáticamente después de 15 días.

---

## Hacer un backup manual

### Backup de UNA base de datos específica

```bash
# Conectar al VPS
ssh root@46.225.137.160

# Backup de una DB específica (ejemplo: cuspia_empresa_test)
docker exec cuspia_db pg_dump -U cuspia cuspia_empresa_test | gzip > /opt/cuspia/backups/manual_empresa_test_$(date +%Y%m%d_%H%M).sql.gz
```

### Backup de TODAS las bases de datos (ejecutar el script)

```bash
/opt/cuspia/scripts/backup.sh
```

### Descargar un backup a tu ordenador

```bash
# Desde tu Mac (no desde el VPS)
scp root@46.225.137.160:/opt/cuspia/backups/2026-02-16/cuspia_empresa_test_0200.sql.gz ~/Desktop/
```

---

## Restaurar una base de datos

### ⚠️ ANTES DE RESTAURAR — Lee esto

> **IMPORTANTE**: Restaurar una base de datos **sobreescribe TODOS los datos actuales** de esa DB.
> Haz siempre un backup fresco de la DB actual antes de restaurar.

### Paso 1: Backup de seguridad (de la DB actual)

```bash
ssh root@46.225.137.160

# Backup de la DB actual ANTES de tocar nada
docker exec cuspia_db pg_dump -U cuspia cuspia_empresa_test | gzip > /opt/cuspia/backups/pre_restore_empresa_test_$(date +%Y%m%d_%H%M).sql.gz
```

### Paso 2: Parar el backend (evitar escrituras durante la restauración)

```bash
docker stop cuspia_backend
```

### Paso 3: Restaurar el backup

```bash
# Restaurar un backup específico
# OPCIÓN A: Restaurar sobre la misma DB (sobreescribe datos)
gunzip -c /opt/cuspia/backups/2026-02-15/cuspia_empresa_test_0200.sql.gz | \
  docker exec -i cuspia_db psql -U cuspia -d cuspia_empresa_test

# Si hay errores de "tabla ya existe", primero limpia la DB:
docker exec cuspia_db psql -U cuspia -d postgres -c "DROP DATABASE cuspia_empresa_test;"
docker exec cuspia_db psql -U cuspia -d postgres -c "CREATE DATABASE cuspia_empresa_test;"
gunzip -c /opt/cuspia/backups/2026-02-15/cuspia_empresa_test_0200.sql.gz | \
  docker exec -i cuspia_db psql -U cuspia -d cuspia_empresa_test
```

### Paso 4: Reiniciar el backend

```bash
docker start cuspia_backend

# Verificar que arranca correctamente
sleep 10
curl -s https://api.cuspia.com/api/v1/health
# Debe responder: {"status":"ok",...}
```

### Paso 5: Verificar la restauración

```bash
# Comprobar que las tablas tienen datos
docker exec cuspia_db psql -U cuspia -d cuspia_empresa_test -c "SELECT count(*) FROM patients;"
docker exec cuspia_db psql -U cuspia -d cuspia_empresa_test -c "SELECT count(*) FROM appointments;"
docker exec cuspia_db psql -U cuspia -d cuspia_empresa_test -c "SELECT count(*) FROM users;"
```

---

## Restaurar TODAS las bases de datos

En caso de desastre total (pérdida completa de datos):

```bash
ssh root@46.225.137.160

# Parar backend
docker stop cuspia_backend

# Elegir la fecha del backup a restaurar
BACKUP_DATE="2026-02-15"

# Restaurar cada DB
for FILE in /opt/cuspia/backups/$BACKUP_DATE/*.sql.gz; do
    DB_NAME=$(basename "$FILE" | sed 's/_[0-9]\{4\}\.sql\.gz//')
    echo "Restaurando: $DB_NAME desde $FILE"
    
    docker exec cuspia_db psql -U cuspia -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
    docker exec cuspia_db psql -U cuspia -d postgres -c "CREATE DATABASE $DB_NAME;"
    gunzip -c "$FILE" | docker exec -i cuspia_db psql -U cuspia -d "$DB_NAME"
done

# Reiniciar backend
docker start cuspia_backend
sleep 10
curl -s https://api.cuspia.com/api/v1/health
```

---

## Verificar un backup

Sin restaurar nada, puedes verificar que un backup es válido:

```bash
# Ver el contenido de un backup (sin restaurar)
gunzip -c /opt/cuspia/backups/2026-02-16/cuspia_empresa_test_0129.sql.gz | head -50

# Verificar que no está corrupto (debe salir sin errores)
gunzip -t /opt/cuspia/backups/2026-02-16/cuspia_empresa_test_0129.sql.gz && echo "✅ OK" || echo "❌ CORRUPTO"

# Ver el tamaño descomprimido
gunzip -c /opt/cuspia/backups/2026-02-16/cuspia_empresa_test_0129.sql.gz | wc -c
```

---

## Escenarios de emergencia

### 🔴 "He borrado datos por accidente"

```bash
ssh root@46.225.137.160

# 1. Parar backend inmediatamente
docker stop cuspia_backend

# 2. Ver qué backups hay disponibles
ls -la /opt/cuspia/backups/

# 3. Elegir el backup más reciente ANTERIOR al error
# 4. Seguir los pasos de "Restaurar una base de datos" arriba

# 5. Reiniciar
docker start cuspia_backend
```

### 🔴 "El servidor se ha caído y necesito migrar"

```bash
# Desde tu Mac, descarga TODOS los backups
scp -r root@46.225.137.160:/opt/cuspia/backups/ ~/cuspia-backups/

# En el nuevo servidor, sube los backups y restaura
scp -r ~/cuspia-backups/ root@NUEVO_SERVIDOR:/opt/cuspia/backups/
# Luego sigue los pasos de "Restaurar TODAS las bases de datos"
```

### 🔴 "Quiero restaurar solo UNA tabla"

```bash
# Extraer solo una tabla del backup
gunzip -c /opt/cuspia/backups/2026-02-16/cuspia_empresa_test_0129.sql.gz | \
  grep -A 99999 "^COPY public.patients" | \
  sed '/^\\\.$/q' > /tmp/patients_only.sql

# Revisar antes de importar
head -20 /tmp/patients_only.sql

# Importar solo esa tabla (cuidado: borra datos actuales de esa tabla)
docker exec cuspia_db psql -U cuspia -d cuspia_empresa_test -c "TRUNCATE patients CASCADE;"
cat /tmp/patients_only.sql | docker exec -i cuspia_db psql -U cuspia -d cuspia_empresa_test
```

---

## Configuración

### Cambiar la hora del backup

```bash
# Editar el cron
crontab -e

# Formato: minuto hora * * *
# Ejemplo: cambiar a las 4:00 AM
0 4 * * * /opt/cuspia/scripts/backup.sh
```

### Cambiar la retención (días)

```bash
# Editar el script
nano /opt/cuspia/scripts/backup.sh

# Cambiar la línea:
RETENTION_DAYS=15
```

### Ver logs del último backup

```bash
# El script imprime output al ejecutarse
# Para ver si el cron funcionó:
grep backup /var/log/syslog | tail -5
```
