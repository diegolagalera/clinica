# 📊 Información de Tablas - Base de Datos Cuspia

Este documento describe todas las tablas de la base de datos agrupadas por módulos funcionales.

---

## 🏢 Multitenancy (Organización)

| Tabla | Propósito |
|-------|-----------|
| `organizations` | Organizaciones (grupos de clínicas) |
| `clinics` | Clínicas dentro de una organización |

---

## 👤 Usuarios y Autenticación

| Tabla | Propósito |
|-------|-----------|
| `users` | Usuarios del sistema (SUPERADMIN, ADMIN, WORKER, USER) |
| `staff_profiles` | Perfil extendido de trabajadores (licencia, especialidad, color calendario) |
| `worker_clinics` | Asignación N:M de trabajadores a múltiples clínicas |
| `refresh_tokens` | Tokens de refresco para autenticación JWT |

---

## 🧑‍⚕️ Pacientes

| Tabla | Propósito |
|-------|-----------|
| `patients` | Datos de pacientes (personales, médicos, seguro, consentimiento) |

---

## 📅 Citas

| Tabla | Propósito |
|-------|-----------|
| `appointments` | Citas médicas (fecha, estado, duración real vs planificada, tracking en tiempo real) |
| `appointment_workers` | Asignación N:M de profesionales a una cita |

---

## 📋 Historial Clínico

| Tabla | Propósito |
|-------|-----------|
| `clinical_records` | Notas clínicas, procedimientos, diagnósticos, tratamientos |
| `radiographs` | Radiografías subidas (imágenes, tipo, anotaciones) |
| `radiograph_ai_results` | Resultados de análisis IA de radiografías (GPT-4 Vision) |

---

## 🦷 Odontograma (Dental Chart)

| Tabla | Propósito |
|-------|-----------|
| `odontograms` | Odontograma del paciente (adulto 32 dientes / niño 20 dientes) |
| `odontogram_teeth` | Estado de cada diente (FDI notation, condiciones por superficie) |
| `odontogram_history` | Historial de cambios en dientes (auditoría) |
| `odontogram_snapshots` | Capturas del estado antes/después de tratamientos |

---

## 📦 Stock e Inventario

| Tabla | Propósito |
|-------|-----------|
| `suppliers` | Proveedores de materiales |
| `inventory_items` | Items de inventario (stock actual, mínimo, precios, ubicación, caducidad) |
| `stock_movements` | Historial de movimientos (IN, OUT, ADJUSTMENT, EXPIRED) con coste unitario |
| `stock_packs` | Packs predefinidos de materiales para procedimientos |
| `stock_pack_items` | Items y cantidades dentro de un pack |
| `appointment_stock_usage` | Material consumido en cada cita (registro por cita activa) |

---

## 💰 Facturación y Pagos

| Tabla | Propósito |
|-------|-----------|
| `invoices` | Facturas (número, estado, IVA, total, items) |
| `payments` | Pagos asociados a facturas (método, referencia) |
| `expenses` | Gastos de la clínica (categoría, proveedor, adjuntos) |

---

## 📧 Notificaciones Email

| Tabla | Propósito |
|-------|-----------|
| `email_settings` | Configuración SMTP por clínica (Gmail, host, puerto, credenciales) |
| `email_templates` | Plantillas de email personalizables (bloques visuales, variables) |
| `notification_logs` | Historial de emails/SMS enviados (estado, errores) |
| `pending_notifications` | Cola de notificaciones con debounce de 5 minutos |

---

## 📱 Notificaciones SMS (Twilio)

| Tabla | Propósito |
|-------|-----------|
| `sms_settings` | Configuración Twilio por clínica (SID, token, número origen) |
| `sms_templates` | Plantillas de SMS (máx recomendado 160 caracteres) |

---

## ⭐ Valoraciones de Visitas

| Tabla | Propósito |
|-------|-----------|
| `rating_requests` | Solicitudes de valoración (enviadas 24h después de cita completada) |
| `visit_ratings` | Valoraciones recibidas (1-5 estrellas + comentario opcional) |
| `worker_ratings` | Valoraciones replicadas a cada profesional asignado a la cita |

---

## 🔍 Auditoría e IA

| Tabla | Propósito |
|-------|-----------|
| `audit_logs` | Logs de auditoría (acciones CRUD, login, export, AI analysis) |
| `document_embeddings` | Embeddings para búsqueda semántica RAG (preparado para pgvector) |

---

## 📈 Resumen

| Módulo | Nº Tablas |
|--------|-----------|
| Multitenancy | 2 |
| Usuarios y Auth | 4 |
| Pacientes | 1 |
| Citas | 2 |
| Historial Clínico | 3 |
| Odontograma | 4 |
| Stock e Inventario | 6 |
| Facturación | 3 |
| Email Notifications | 4 |
| SMS Notifications | 2 |
| Valoraciones | 3 |
| Auditoría e IA | 2 |
| **TOTAL** | **36** |

---

## 🔧 Notas Técnicas

- **ORM**: Drizzle ORM con PostgreSQL
- **IDs**: UUID v4 generados automáticamente
- **Timestamps**: `created_at` y `updated_at` en todas las tablas principales
- **Soft Delete**: Se usa `is_active` en lugar de borrado físico para datos sensibles
- **Multitenancy**: Todas las tablas de datos tienen `clinic_id` para aislamiento
- **Formato teléfono**: E.164 internacional (ej: `+34612345678`)
