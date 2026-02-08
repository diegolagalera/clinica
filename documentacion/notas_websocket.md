# WebSocket - Arquitectura de Sincronización en Tiempo Real

## Resumen

El sistema usa **Socket.io** para sincronización en tiempo real de citas y stock entre trabajadores.

## Arquitectura de Salas (Rooms)

```
┌──────────────────────────────────────────────────────────┐
│                  Socket.io Server                        │
├──────────────────────────────────────────────────────────┤
│  user:worker-A      ←── Sala personal de cada usuario    │
│  user:worker-B                                           │
│  org:org-123        ←── Sala de organización (backup)    │
│  appointment:xyz    ←── Sala de cita específica          │
└──────────────────────────────────────────────────────────┘
```

### Al conectar, cada usuario se une a:
1. **`user:{userId}`** - Para eventos dirigidos a él específicamente
2. **`org:{orgId}`** - Para eventos globales de la organización

### Dinámicamente:
3. **`appointment:{appointmentId}`** - Al abrir PatientDetail con cita activa

## Eventos

| Evento | Sala | Destinatarios |
|--------|------|---------------|
| `appointment:started` | `user:{id}` por worker | Solo workers asignados |
| `appointment:completed` | `user:{id}` por worker | Solo workers asignados |
| `appointment:updated` | `user:{id}` por worker | Solo workers asignados |
| `stock:updated` | `appointment:{id}` | Quienes tienen la cita abierta |

## Flujo de Conexión

```
1. Frontend → connectWebSocket(accessToken)
2. Backend verifica JWT
3. Socket se une a user:{userId} + org:{orgId}
4. Cliente listo para recibir eventos
```

## Flujo de Stock en Tiempo Real

```
1. Worker A abre PatientDetail con cita activa
2. Frontend → emit('join:appointment', { appointmentId })
3. Worker A añade stock
4. Backend → emitToAppointment(appointmentId, 'stock:updated', items)
5. Worker B (si tiene la cita abierta) recibe el evento
6. Al salir de PatientDetail → emit('leave:appointment')
```

## Escalabilidad

| Usuarios | Solución |
|----------|----------|
| 3,000 | ✅ Un servidor suficiente |
| 10,000+ | Redis Adapter para múltiples servers |
| 50,000+ | Horizontal scaling + Redis Cluster |

Socket.io puede manejar **10,000-50,000 conexiones** en un solo servidor.

## Archivos Principales

- **Backend**: `backend/src/websocket.ts`
- **Frontend**: `frontend/src/services/websocket.ts`
- **Integration**: `frontend/src/pages/clinic/PatientDetail.vue`

## Para Producción

Añadir si es necesario:
1. Rate limiting
2. Redis Adapter (múltiples instancias)
3. Monitoring de conexiones activas
