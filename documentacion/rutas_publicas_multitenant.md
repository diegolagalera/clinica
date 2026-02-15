# Arquitectura Multi-Tenant — Rutas Públicas

Documentación de cómo se manejan las rutas sin autenticación en la arquitectura multi-tenant (subdominios).

## Contexto

En la arquitectura multi-tenant, cada empresa tiene su propia base de datos. Las rutas autenticadas resuelven el tenant desde el JWT (`tenantSlug` en el token). Sin embargo, hay rutas **públicas** donde no hay JWT y por tanto no hay forma automática de saber a qué tenant pertenece la petición.

Este documento cubre las 3 rutas públicas que requieren contexto de tenant:
1. **WhatsApp Webhook** — Meta envía mensajes y verificaciones
2. **Refresh Token** — Renovar sesión (SUPERADMIN vs tenant)
3. **Imágenes de Stock** — `<img>` tags no envían headers de auth

---

## 1. WhatsApp Webhook

### Problema
Meta envía requests al webhook sin autenticación. El backend necesita saber a qué empresa/clínica pertenece el mensaje.

### Solución: Tenant Slug en la URL

```
GET  /api/v1/whatsapp/webhook/:tenantSlug   → Verificación de Meta
POST /api/v1/whatsapp/webhook/:tenantSlug   → Recepción de mensajes
```

**Flujo de verificación (GET):**
```
Meta → GET /webhook/mi-clinica?hub.verify_token=xxx
     → tenantManager.getConnection('mi-clinica')
     → Busca webhookVerifyToken en whatsapp_settings del tenant
     → Si coincide → 200 + challenge
```

**Flujo de mensajes (POST):**
```
Meta → POST /webhook/mi-clinica { phone_number_id: '123...' }
     → tenantManager.getConnection('mi-clinica')
     → Busca phoneNumberId en whatsapp_settings → identifica la clínica
     → Procesa el mensaje con el chatbot de esa clínica
```

### ¿Por qué no se necesita `:clinicaSlug`?
- El `phoneNumberId` en el payload de Meta ya identifica la clínica exacta
- En verificación, se busca el token entre las clínicas del tenant (pocas, búsqueda instantánea)

### Configuración en Meta
Cada empresa configura su webhook en Meta → Developers → WhatsApp con:
- **Callback URL:** `https://cuspia.com/api/v1/whatsapp/webhook/SLUG-EMPRESA`
- **Verify Token:** El token configurado en Ajustes de WhatsApp de su clínica

### Para desarrollo local (ngrok)
```bash
ngrok http 3000
# URL: https://xxxx.ngrok-free.app/api/v1/whatsapp/webhook/SLUG-EMPRESA
```

### Archivo: `backend/src/controllers/webhook.controller.ts`

---

## 2. Refresh Token (SUPERADMIN)

### Problema
El endpoint `/auth/refresh` es público (no autenticado). Los usuarios de tenant incluyen `tenantSlug` en su refresh JWT, pero el SUPERADMIN no pertenece a ningún tenant.

### Solución: Refresh Stateless para SUPERADMIN

```
POST /api/v1/auth/refresh { refreshToken: '...' }
```

**Flujo tenant (ADMIN/WORKER):**
```
JWT contiene tenantSlug → tenantManager.getConnection(slug)
→ Busca refresh token en tabla refreshTokens → Rota tokens
```

**Flujo SUPERADMIN:**
```
JWT NO contiene tenantSlug → Consulta centralDb.superadmins
→ Verifica que el superadmin existe y está activo
→ Re-emite tokens statelessly (sin buscar en tabla de refresh tokens)
```

### ¿Por qué stateless?
- No existe tabla `refreshTokens` en la base de datos central
- El SUPERADMIN es un rol único y de confianza — verificar su existencia y estado activo es suficiente
- Los tokens de tenant SÍ se almacenan y rotan normalmente

### Archivo: `backend/src/controllers/auth.controller.ts`

---

## 3. Imágenes de Stock

### Problema
Las etiquetas `<img>` del navegador no envían headers de autenticación. El endpoint de imágenes necesita saber de qué tenant cargar la imagen (bucket de MinIO).

### Solución: Query Parameter `?tenant=slug`

```
GET /api/v1/stock/:id/image?tenant=mi-clinica
```

**Frontend:**
```javascript
// Helper en Inventory.vue y PatientDetail.vue
function stockImageUrl(itemId) {
  return `${API_URL}/stock/${itemId}/image?tenant=${getTenantSlug()}`
}
```

**Backend:**
```
?tenant=mi-clinica → tenantManager.getConnection('mi-clinica')
→ Busca el item en la DB del tenant → Resuelve bucket de MinIO
→ Devuelve la imagen con Cache-Control headers
```

### Archivo: `backend/src/controllers/stock.controller.ts`

---

## Resumen de Patrones

| Ruta Pública | Cómo identifica el tenant | Archivo |
|---|---|---|
| WhatsApp Webhook | `:tenantSlug` en URL path | `webhook.controller.ts` |
| Refresh Token | `tenantSlug` en JWT (o centralDb si no hay) | `auth.controller.ts` |
| Imágenes de Stock | `?tenant=slug` query param | `stock.controller.ts` |

## Regla General

Para cualquier nueva ruta pública que necesite contexto de tenant:
1. **Si Meta/tercero configura la URL** → Slug en el path (`:tenantSlug`)
2. **Si el frontend genera la URL** → Query parameter (`?tenant=slug`)
3. **Si hay un JWT disponible** → Extraer del JWT (como refresh token)
