# 📊 Diagrama de Estados de Citas (Appointments)

## Estados Disponibles

| Estado | Descripción | ¿Terminal? |
|--------|-------------|------------|
| `SCHEDULED` | Cita programada (estado inicial) | No |
| `IN_PROGRESS` | Cita activa/en curso | No |
| `COMPLETED` | Cita finalizada | ✅ Sí |
| `CANCELLED` | Cita cancelada | ✅ Sí |
| `NO_SHOW` | Paciente no asistió | ✅ Sí |

---

## Diagrama de Flujo

```
                                    ┌─────────────────┐
                                    │    CREACIÓN     │
                                    │   (API POST)    │
                                    └────────┬────────┘
                                             │
                                             ▼
                       ┌─────────────────────────────────────────┐
                       │              SCHEDULED                   │
                       │         (Cita Programada)               │
                       │                                          │
                       │  • Se puede editar (fecha, hora, worker) │
                       │  • Se puede arrastrar en el calendario   │
                       │  • Se puede redimensionar                │
                       └──────┬──────────────┬──────────────┬─────┘
                              │              │              │
              ┌───────────────┘              │              └───────────────┐
              │                              │                              │
              ▼                              ▼                              ▼
   ┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
   │   IN_PROGRESS    │          │    CANCELLED     │          │     NO_SHOW      │
   │  (En Progreso)   │          │   (Cancelada)    │          │ (Paciente no vino)│
   │                  │          │                  │          │                  │
   │ • realStartTime  │          │ • Estado FINAL   │          │ • Estado FINAL   │
   │ • Puede pausarse │          │ • No editable    │          │ • No editable    │
   │ • Puede añadir   │          └──────────────────┘          └──────────────────┘
   │   más workers    │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │    COMPLETED     │
   │   (Completada)   │
   │                  │
   │ • realEndTime    │
   │ • Estado FINAL   │
   │ • Rating request │
   │   enviado        │
   └──────────────────┘
```

---

## 🔄 Transiciones Válidas

| Desde | Hacia | Acción | Quién puede ejecutar |
|-------|-------|--------|---------------------|
| *(nueva)* | `SCHEDULED` | Crear cita en calendario | Admin / Worker |
| `SCHEDULED` | `IN_PROGRESS` | Click "Iniciar" | Solo workers asignados a la cita |
| `SCHEDULED` | `CANCELLED` | Cancelar cita | Admin / Worker |
| `SCHEDULED` | `NO_SHOW` | Marcar ausencia del paciente | Admin / Worker |
| `IN_PROGRESS` | `COMPLETED` | Click "Finalizar" | Workers asignados |

---

## 📝 Reglas de Negocio

### Al Iniciar una Cita (`SCHEDULED` → `IN_PROGRESS`)
- Solo los **workers asignados** pueden iniciar la cita
- El paciente **no puede tener otra cita activa** en la misma clínica
- Se registra `realStartTime` con la hora actual

### Durante una Cita en Progreso (`IN_PROGRESS`)
- Se pueden **añadir más workers** a la cita
- La cita puede **pausarse** (se guarda `pausedDuration`)
- Se puede registrar uso de stock/materiales

### Al Completar una Cita (`IN_PROGRESS` → `COMPLETED`)
- Si la clínica tiene `requireStockOnCompletion = true`, debe haber stock registrado
- Se registra `realEndTime` con la hora actual
- Se envía solicitud de valoración (rating) al paciente

### Al Cancelar una Cita (`SCHEDULED` → `CANCELLED`)
- Se envía notificación de cancelación **inmediatamente** (sin debounce)
- Se cancelan las notificaciones pendientes

---

## 🔔 Notificaciones Automáticas

| Transición | Notificación | Timing |
|------------|--------------|--------|
| Crear cita | Confirmación (email/SMS) | Debounced 5 min |
| Modificar hora | Confirmación actualizada | Debounced 5 min |
| Cancelar cita | Cancelación | Inmediata |
| Completar cita | Solicitud de rating | Inmediata |

---

## 🕐 Campos de Tiempo

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `startTime` | DateTime | Hora programada de inicio |
| `endTime` | DateTime | Hora programada de fin |
| `realStartTime` | DateTime | Hora real que se inició (click "Iniciar") |
| `realEndTime` | DateTime | Hora real que se finalizó (click "Completar") |
| `pausedDuration` | Integer | Minutos acumulados en pausa |
| `duration` | Integer | Duración programada en minutos |
