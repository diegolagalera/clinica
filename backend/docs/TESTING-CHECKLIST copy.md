# 🧪 Checklist de Testing — Cuspia ERP

> Checklist completo para verificar todas las funcionalidades del sistema después de un reset o despliegue nuevo.

---

## 🏗️ Infraestructura

### Docker & Servicios
- [ ] `docker compose up -d` levanta todos los contenedores sin errores
- [ ] PostgreSQL principal accesible en puerto 5432
- [ ] PostgreSQL central accesible en puerto 5433
- [ ] Redis accesible en puerto 6379
- [ ] MinIO accesible en puerto 9000 (API) y 9001 (consola)
- [ ] `npm run dev` (backend) arranca sin errores
- [ ] `npm run dev` (frontend) arranca sin errores

### Base de Datos Central
- [ ] `npm run central:push` crea las tablas (`tenants`, `global_users`, `superadmins`)
- [ ] `npm run central:studio` abre Drizzle Studio correctamente

---

## 👥 Multi-Tenant

### Provisioning
- [ ] Crear SUPERADMIN con `--create-superadmin`
- [ ] Provisionar Tenant A (ej: `mi-clinica`)
- [ ] Provisionar Tenant B (ej: `otra-clinica`)
- [ ] Verificar que se creó la DB `cuspia_mi_clinica`
- [ ] Verificar que se creó la DB `cuspia_otra_clinica`
- [ ] Verificar que se creó el bucket MinIO `cuspia-mi-clinica`
- [ ] Verificar que se creó el bucket MinIO `cuspia-otra-clinica`
- [ ] Verificar registros en tabla `tenants` (central)
- [ ] Verificar registros en tabla `global_users` (central)

### Cleanup
- [ ] `cleanup-tenant.ts --slug <slug>` elimina tenant de DB central
- [ ] Elimina entradas de `global_users`
- [ ] Elimina el bucket MinIO y su contenido
- [ ] Elimina la base de datos del tenant

### Migraciones
- [ ] `migrate-all-tenants.ts` aplica migraciones a todos los tenants
- [ ] `--slug <slug>` aplica solo a un tenant específico
- [ ] `--dry-run` muestra tenants sin modificar nada

### Aislamiento de Datos
- [ ] Datos del Tenant A NO son visibles desde Tenant B
- [ ] Archivos del Tenant A NO accesibles desde bucket del Tenant B
- [ ] Un usuario del Tenant A NO puede autenticarse en Tenant B (a menos que exista en ambos)

---

## 🔐 Autenticación

### Login
- [ ] Login con email + contraseña (usuario normal)
- [ ] Login con SUPERADMIN
- [ ] Login con usuario que existe en 1 solo tenant → acceso directo
- [ ] Login con usuario que existe en 2+ tenants → selector de empresa
- [ ] Seleccionar empresa y acceder correctamente
- [ ] Error con contraseña incorrecta
- [ ] Error con email inexistente
- [ ] Token de acceso (JWT) se genera correctamente
- [ ] Refresh token funciona al expirar el access token

### Recuperación de Contraseña
- [ ] "Olvidé mi contraseña" envía email con enlace
- [ ] Enlace de reset funciona (token válido)
- [ ] Token expirado muestra mensaje de error
- [ ] Usuario en 1 tenant → formulario directo
- [ ] Usuario en 2+ tenants → selector de empresa
- [ ] Cambiar contraseña en empresa seleccionada
- [ ] Tokens se limpian de las demás empresas
- [ ] No se revela si el email existe o no (seguridad)

### 2FA (Autenticación de dos factores)
- [ ] Configurar 2FA genera código QR
- [ ] Verificar código TOTP correcto
- [ ] Rechazar código TOTP incorrecto
- [ ] Desactivar 2FA

### Logout
- [ ] Cerrar sesión invalida el token
- [ ] Refresh token deja de funcionar tras logout

---

## 🏢 Organización & Clínicas

### Organización
- [ ] Ver datos de la organización
- [ ] Editar nombre, email, teléfono, dirección

### Clínicas (CRUD)
- [ ] Crear nueva clínica
- [ ] Editar clínica existente
- [ ] Ver lista de clínicas
- [ ] Los horarios se configuran correctamente (08:00-22:00)
- [ ] Cambiar de clínica (context switching) funciona
- [ ] Al cambiar de clínica se recarga la página correctamente

---

## 👨‍⚕️ Gestión de Personal

### CRUD de Personal
- [ ] Crear nuevo trabajador (WORKER)
- [ ] Crear nuevo admin (ADMIN)
- [ ] Editar datos del trabajador
- [ ] Desactivar un trabajador
- [ ] Verificar que el nuevo usuario se registra en `global_users`

### Asignación a Clínicas
- [ ] Asignar trabajador a una clínica
- [ ] Desasignar trabajador de una clínica
- [ ] Trabajador solo ve las clínicas asignadas

### Reset de Contraseña (desde panel admin)
- [ ] Admin puede resetear contraseña de un trabajador
- [ ] Contraseña nueva funciona al hacer login

---

## 🧑‍🤝‍🧑 Pacientes

### CRUD
- [ ] Crear paciente con todos los campos
- [ ] Teléfono se guarda en formato E.164
- [ ] Editar paciente
- [ ] Desactivar paciente (no borrar)
- [ ] Buscar pacientes por nombre/email/teléfono
- [ ] Filtrar pacientes (activos/inactivos)

### Preferencias
- [ ] Toggle "Acepta emails de marketing"
- [ ] Toggle "Acepta felicitaciones de cumpleaños"

### Historial del Paciente
- [ ] Ver historial de citas
- [ ] Ver historial clínico
- [ ] Ver radiografías del paciente
- [ ] Ver odontograma del paciente

---

## 📅 Citas

### CRUD
- [ ] Crear nueva cita
- [ ] Asignar trabajador(es) a la cita
- [ ] Editar hora/fecha de la cita
- [ ] Cancelar cita
- [ ] Restricción horaria (08:00-22:00)

### Drag & Drop
- [ ] Mover cita arrastrando en el calendario
- [ ] No se puede mover una cita finalizada (feedback de estado)
- [ ] No se puede mover cita si no tienes permisos (feedback de autorización)

### Estado de la Cita (State Machine)
- [ ] Pendiente → En curso
- [ ] En curso → Completada
- [ ] Completada es inmutable (read-only)
- [ ] Admin Reset funciona
- [ ] Cancelar sesión activa requiere verificación de texto (handshake)

### Sesión Activa
- [ ] Iniciar sesión de cita
- [ ] Ver/editar datos durante la sesión
- [ ] Finalizar sesión

---

## 🦷 Registros Clínicos

### Historial Clínico
- [ ] Crear nuevo registro clínico
- [ ] Editar registro durante sesión activa
- [ ] Registro se bloquea al finalizar sesión (read-only)
- [ ] Firmado de registro clínico

### Voice-to-Form (IA)
- [ ] Grabar audio con el micrófono
- [ ] Transcripción con Whisper funciona
- [ ] Extracción de datos con GPT-4 rellena el formulario
- [ ] Verificar que los campos se llenan correctamente

---

## 🦷 Odontograma

### Visualización
- [ ] Renderizado SVG de 32 dientes (FDI)
- [ ] Notación FDI correcta
- [ ] Raíces anatómicas visibles

### Interacción
- [ ] Seleccionar diente completo
- [ ] Seleccionar cara individual (oclusal, mesial, etc.)
- [ ] Seleccionar raíz
- [ ] Aplicar condición desde panel Corona
- [ ] Aplicar condición desde panel Raíz
- [ ] Condición se aplica correctamente al elemento seleccionado

### Historial
- [ ] Guardar snapshot del odontograma
- [ ] Comparar snapshots lado a lado
- [ ] Ver historial de cambios (audit log)

---

## 📸 Radiografías

### CRUD
- [ ] Subir radiografía (imagen)
- [ ] Ver radiografía en detalle
- [ ] Eliminar radiografía
- [ ] Imagen se guarda en bucket MinIO del tenant correcto

### Análisis IA (GPT-4 Vision)
- [ ] Botón de análisis IA (trigger manual)
- [ ] Análisis se ejecuta correctamente
- [ ] Resultados se muestran al usuario
- [ ] Resultados se guardan en la DB
- [ ] Disclaimer de "ayuda diagnóstica" visible

---

## 📦 Stock & Inventario

### Productos (CRUD)
- [ ] Crear producto con todos los campos
- [ ] Subir imagen de producto → se guarda en bucket del tenant
- [ ] Editar producto
- [ ] Desactivar producto
- [ ] Buscar productos

### Movimientos de Stock
- [ ] Entrada de stock (compra)
- [ ] Salida de stock (consumo)
- [ ] Ver historial de movimientos
- [ ] Stock mínimo genera alerta

### Packs
- [ ] Crear pack con múltiples productos
- [ ] Expandir pack en unidades individuales

### Proveedores
- [ ] CRUD de proveedores
- [ ] Asociar proveedor a productos

### Consumo en Cita
- [ ] Marcar productos consumidos durante sesión
- [ ] Confirmación atómica (deferred persistence)
- [ ] Flag `isConfirmed` para sincronización multi-worker
- [ ] Banner de consumo activo visible

### Escáner de Código de Barras
- [ ] Escanear código de barras para buscar producto
- [ ] Identificación visual con IA

---

## 💬 WhatsApp / Chatbot

### Configuración
- [ ] Configurar WhatsApp settings (API key, phone number ID)
- [ ] Verificar webhook de Meta funciona

### Mensajería
- [ ] Recibir mensaje de paciente (webhook)
- [ ] Enviar mensaje de texto a paciente
- [ ] Enviar imagen/documento desde interfaz
- [ ] Media se guarda en bucket MinIO del tenant
- [ ] Media se sirve correctamente desde `/api/v1/media/*`

### Chatbot IA
- [ ] Respuesta automática con IA
- [ ] Knowledge base funciona
- [ ] Quick replies configurables

### Leads
- [ ] Nuevo contacto crea lead automáticamente
- [ ] Ver lista de leads
- [ ] Convertir lead en paciente

---

## 📧 Email

### Configuración SMTP
- [ ] Configurar credenciales SMTP de la clínica
- [ ] Enviar email de prueba

### Templates
- [ ] Ver templates predefinidos
- [ ] Crear template personalizado (Unlayer editor)
- [ ] Previsualizar template

### Campañas de Marketing
- [ ] Crear campaña con segmento de audiencia
- [ ] Enviar campaña
- [ ] Ver estadísticas de envío

### Cumpleaños
- [ ] Configurar felicitación automática
- [ ] Verificar envío en la fecha correcta

---

## 📱 SMS

### Configuración
- [ ] Configurar credenciales Twilio
- [ ] Sender ID máximo 11 caracteres alfanuméricos

### Envío
- [ ] Enviar SMS de prueba
- [ ] SMS de notificación de cita
- [ ] SMS de recordatorio

---

## 🔔 Notificaciones

### Email/SMS de Citas
- [ ] Notificación al crear cita
- [ ] Notificación al modificar cita
- [ ] Debounce: modificaciones rápidas envían solo 1 notificación (espera 5 min)
- [ ] Notificación al cancelar cita

### Valoraciones
- [ ] Enviar solicitud de valoración post-cita
- [ ] Paciente puede valorar desde el link
- [ ] Ver valoraciones en el dashboard

---

## 💰 Facturación

### Facturas
- [ ] Crear factura
- [ ] Asociar factura a paciente
- [ ] Registrar pago
- [ ] Ver historial de facturas

### Gastos
- [ ] Registrar gasto
- [ ] Categorizar gasto
- [ ] Ver historial de gastos

---

## 🛡️ Super Admin

### Dashboard
- [ ] Login como SUPERADMIN
- [ ] Ver lista de todas las organizaciones/tenants
- [ ] Ver detalles de cada tenant
- [ ] Activar/desactivar tenant

### Gestión
- [ ] Ver usuarios de un tenant
- [ ] Resetear contraseña de usuario desde Super Admin

---

## 🔄 WebSockets (Tiempo Real)

- [ ] Conexión WebSocket se establece al cargar la app
- [ ] Fallback de polling (30s) funciona si WS falla
- [ ] Actualización en tiempo real de citas
- [ ] Actualización en tiempo real de stock (consumo en sesión)
- [ ] Notificaciones directas al usuario (appointment starts)

---

## 🐛 Bug Reports

- [ ] Formulario de reporte de bug accesible
- [ ] Captura automática de contexto del entorno
- [ ] Bug se guarda en la DB
- [ ] Se puede ver lista de bugs reportados

---

## 🤖 Asistente IA (CUSPIA Assistant)

- [ ] Widget de chat accesible desde la app
- [ ] Responde preguntas operativas
- [ ] No revela PII (política Zero-PII)
- [ ] Respuestas basadas en documentación funcional

---

## 🔒 Permisos y Roles

### SUPERADMIN
- [ ] Accede al dashboard de Super Admin
- [ ] NO puede acceder a datos de tenants directamente
- [ ] Puede activar/desactivar tenants

### ADMIN
- [ ] Gestiona organización, clínicas, personal
- [ ] Gestiona todos los pacientes y citas
- [ ] Accede a configuración (SMTP, SMS, WhatsApp)
- [ ] Accede a marketing y campañas

### WORKER
- [ ] Solo ve las clínicas asignadas
- [ ] Puede gestionar pacientes y citas
- [ ] NO puede gestionar personal ni configuración
- [ ] NO puede acceder a facturación

---

## 📱 Responsive & UX General

- [ ] Login responsive en móvil
- [ ] Dashboard responsive
- [ ] Calendario responsive
- [ ] Modales se comportan correctamente
- [ ] Toasts de notificación aparecen correctamente
- [ ] Dark mode (si aplicable)
- [ ] Navegación con sidebar funciona
- [ ] Lazy loading de rutas funciona

---

## 🚀 Orden de Testing Recomendado

1. **Infraestructura** → Docker, DBs, servicios
2. **Multi-Tenant** → Provisioning, aislamiento
3. **Auth** → Login, roles, recuperación contraseña
4. **Organización** → Clínicas, personal
5. **Pacientes** → CRUD, historial
6. **Citas** → CRUD, calendario, sesiones
7. **Clínico** → Odontograma, registros, radiografías
8. **Stock** → Productos, consumo en cita
9. **Comunicación** → WhatsApp, email, SMS
10. **Facturación** → Facturas, pagos, gastos
11. **Admin** → Super Admin dashboard
12. **Extras** → Bug reports, asistente IA, valoraciones
