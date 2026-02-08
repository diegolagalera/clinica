# 📦 Guía del Sistema de Stock

## Introducción

El sistema de stock permite gestionar el inventario de materiales y productos de la clínica. Incluye control de existencias, proveedores, packs predefinidos y analíticas.

---

## 🗂️ Conceptos Clave

### Inventario (Items)
Cada producto o material que se utiliza en la clínica. Tiene:
- **Nombre y SKU**: Identificación única del producto
- **Categoría**: Tipo de material (ej: Instrumental, Consumibles, Anestesia)
- **Stock**: Cantidad actual, mínima y máxima
- **Precios**: Precio de compra y venta (si aplica)
- **Proveedor**: Quién lo suministra
- **Ubicación**: Dónde se almacena (ej: Armario 1, Cajón 2)

### Proveedores
Empresas o personas que suministran los productos. Almacena:
- Datos de contacto (email, teléfono, web)
- Dirección
- Notas sobre condiciones de compra

### Packs
Conjuntos predefinidos de materiales para procedimientos específicos.
- Ejemplo: "Pack Endodoncia" contiene limas, gutapercha, irrigadores, etc.
- Se usan para descontar stock rápidamente al realizar un tratamiento.

---

## 🔄 Tipos de Movimiento de Stock

| Tipo | Símbolo | Qué hace | Cuándo usarlo |
|------|---------|----------|---------------|
| **Entrada** | 🟢 | +X unidades | Recibir pedido, devolución |
| **Salida** | 🔴 | -X unidades | Pérdida, rotura, dar de baja manual |
| **Ajuste** | 🔵 | = X unidades | Corregir tras inventario físico |
| **Caducado** | 🟡 | -X unidades | Material vencido |

### Entrada (IN)
**Suma** unidades al stock actual.

**Casos de uso:**
- Llegó un pedido del proveedor
- Devolución de material de otra clínica
- Donación de producto

**Información que se guarda:**
- Cantidad añadida
- Precio unitario de compra (para calcular promedio)
- Fecha y usuario

### Salida (OUT)
**Resta** unidades del stock actual.

**Casos de uso:**
- Material roto o dañado
- Pérdida o robo
- Dar de baja sin motivo de caducidad

> 💡 Las salidas automáticas por uso en citas se registran como consumo, no como salida manual.

### Ajuste (ADJUSTMENT)
**Establece** el stock a un valor exacto (no suma ni resta).

**Casos de uso:**
- Después de un inventario físico, el conteo no coincide con el sistema
- Corregir un error de registro anterior
- Establecer stock inicial al dar de alta un producto

**Ejemplo:**
```
Sistema dice: 100 unidades
Contaste: 87 unidades
→ Ajuste a 87 (el sistema registra la diferencia: -13)
```

### Caducado (EXPIRED)
**Resta** unidades, pero queda registrado como pérdida por caducidad.

**Casos de uso:**
- Guantes que expiraron
- Anestésicos vencidos
- Composites caducados

**¿Por qué no usar Salida?**
Porque en los informes puedes ver específicamente cuánto dinero pierdes por caducidad y mejorar tu gestión de compras.

---

## 💰 Precio Promedio Ponderado

El sistema calcula automáticamente el precio de compra promedio cuando recibes stock a diferentes precios.

**Ejemplo:**
| Fecha | Cantidad | Precio/ud | Valor |
|-------|----------|-----------|-------|
| 15/01 | 100 ud | 1.00€ | 100€ |
| 30/01 | 50 ud | 1.10€ | 55€ |
| **Total** | **150 ud** | - | **155€** |

**Nuevo precio promedio:** 155€ ÷ 150 ud = **1.03€/ud**

Este precio se usa para:
- Calcular el valor total del inventario
- Saber el coste de material por cita
- Informes de consumo

---

## 📊 Analíticas de Stock

El dashboard de analíticas muestra:

### KPIs
- **Total Items**: Productos activos
- **Valor Total**: Suma de (stock × precio compra)
- **Entradas/Salidas**: Movimientos del período
- **Stock Bajo**: Items por debajo del mínimo

### Historial de Movimientos
Tabla con todos los movimientos filtrable por:
- Período (hoy, 7d, 30d, 90d)
- Tipo (Entrada, Salida, Ajuste, Caducado)

### Alertas
- Items con stock bajo o agotado
- Items próximos a caducar

### Consumo por Paciente
Cuánto material se ha usado por cada paciente (trazabilidad).

---

## 📦 Uso de Packs

### Crear un Pack
1. Ve a **Inventario → Ver Packs**
2. Click en **Nuevo Pack**
3. Nombre, descripción y categoría (opcional)
4. Añade items y cantidades

### Aplicar un Pack
Cuando uses un pack durante una cita, el sistema:
1. Descuenta automáticamente cada item
2. Registra el consumo asociado al paciente
3. Queda trazabilidad completa

**Ejemplo:** Pack "Limpieza dental" descuenta: 2 guantes, 1 pasta profiláctica, 1 hilo dental.

---

## 🔍 Filtros de Inventario

En la vista de inventario puedes filtrar por:
- **Búsqueda**: Nombre o SKU
- **Categoría**: Tipo de material
- **Proveedor**: Quién lo suministra (incluye "Sin proveedor")
- **Stock bajo**: Solo items por debajo del mínimo

---

## 📥 Exportar Datos

En Analíticas puedes exportar a CSV:
- Historial de movimientos con todos los detalles
- Incluye fechas, cantidades, precios, usuarios

Útil para:
- Informes contables
- Auditorías
- Análisis en Excel

---

## 📋 Campos Importantes

### SKU vs Código Proveedor
| Campo | Quién lo define | Para qué |
|-------|-----------------|----------|
| **SKU** | Tú (la clínica) | Identificar internamente el producto |
| **Código Proveedor** | El proveedor | Referencia para hacer pedidos |

### Stock Mínimo vs Máximo
- **Mínimo**: Cuando el stock llega a este nivel, aparece alerta
- **Máximo**: Capacidad máxima de almacenamiento (referencia para pedidos)

---

## 🎯 Flujo de Trabajo Típico

1. **Dar de alta productos** en Inventario
2. **Crear proveedores** asociados
3. **Agrupar en packs** por procedimiento
4. **Recibir pedidos** con Entrada (registro de precio)
5. **Usar en citas** (descuento automático o manual)
6. **Revisar analíticas** periódicamente
7. **Ajustar tras inventario** físico si hay diferencias
