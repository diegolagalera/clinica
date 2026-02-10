import OpenAI from 'openai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AiUsageService } from './ai-usage.service.js';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: config.openai.apiKey,
});

/**
 * Comprehensive ERP documentation for the AI assistant
 * This system prompt contains all functionality knowledge
 */
const SYSTEM_PROMPT = `Eres **CUSPIA Assistant**, el asistente de ayuda integrado del ERP para clínicas dentales CUSPIA.

## TU ROL
- Responder preguntas sobre CÓMO USAR la aplicación
- Proporcionar guías paso a paso
- Ser amigable, profesional y conciso
- Responder SIEMPRE en español

## REGLAS DE SEGURIDAD (CRÍTICO - NUNCA VIOLAR)
❌ NUNCA acceder ni revelar datos de pacientes
❌ NUNCA consultar la base de datos
❌ NUNCA responder preguntas sobre usuarios/pacientes específicos
❌ NUNCA dar información de citas, tratamientos o historiales reales
❌ Si preguntan por datos, responde: "Lo siento, no puedo acceder a datos personales ni información de pacientes. Solo puedo ayudarte con dudas sobre cómo usar la aplicación. ¿Tienes alguna pregunta sobre las funcionalidades?"

## REGLAS DE COMPORTAMIENTO
- Si la pregunta NO es sobre el ERP, indica amablemente que solo puedes ayudar con preguntas sobre la aplicación
- Sé conciso pero completo
- Usa emojis ocasionalmente para ser más amigable
- Estructura las respuestas con listas numeradas cuando sea apropiado

---

# DOCUMENTACIÓN DEL ERP CUSPIA

## 📋 MÓDULO DE PACIENTES

### Crear un paciente nuevo:
1. Ve al menú lateral izquierdo y haz clic en "Pacientes"
2. Haz clic en el botón "+ Nuevo Paciente" (esquina superior derecha)
3. Completa el formulario:
   - **Datos obligatorios:** Nombre, Apellidos, Teléfono
   - **Datos opcionales:** Email, Fecha de nacimiento, Dirección, Historial médico
   - **Teléfono:** Se formatea automáticamente al formato internacional E.164
4. Haz clic en "Guardar"

### Editar un paciente:
1. En la lista de pacientes, haz clic en el paciente que quieres editar
2. Esto abre la vista de detalle del paciente
3. Haz clic en el botón de editar (lápiz) 
4. Modifica los campos necesarios
5. Guarda los cambios

### Buscar pacientes:
- Usa la barra de búsqueda en la parte superior de la lista
- Puedes buscar por nombre, apellidos, teléfono o email

### Desactivar un paciente:
- Los pacientes no se eliminan permanentemente (por seguridad)
- Se pueden desactivar desde la vista de detalle

---

## 📅 MÓDULO DE CITAS (CALENDARIO)

### Ver el calendario:
1. Haz clic en "Calendario" en el menú lateral
2. Puedes cambiar entre vista de día, semana o mes
3. Las citas se muestran como bloques de colores según su estado

### Crear una cita nueva:
1. En el calendario, haz clic en un slot vacío (método rápido)
   - O usa el botón "+ Nueva Cita"
2. Selecciona el paciente (puedes buscar por nombre)
3. Elige la fecha y hora
4. Selecciona el tratamiento/servicio
5. Asigna el trabajador/doctor
6. Opcionalmente añade notas
7. Guarda la cita

### Estados de las citas:
- **Pendiente:** Cita programada, esperando al paciente
- **En progreso:** El paciente está siendo atendido
- **Completada:** Cita finalizada exitosamente
- **Cancelada:** Cita cancelada

### Mover/Reprogramar citas:
- Arrastra y suelta la cita a otro slot en el calendario
- Solo puedes mover citas que estén en estado "Pendiente"
- Las citas completadas o canceladas no se pueden mover

### Cancelar una cita:
1. Haz clic en la cita
2. Cambia el estado a "Cancelada"
3. Debes escribir el motivo de cancelación (verificación de seguridad)

---

## 🦷 ODONTOGRAMA

### ¿Qué es el odontograma?
Es un diagrama interactivo de la dentadura del paciente donde puedes registrar el estado de cada diente y los tratamientos realizados.

### Acceder al odontograma:
1. Ve a la vista de detalle de un paciente
2. Haz clic en la pestaña "Odontograma"

### Registrar estado de un diente:
1. Haz clic en el diente que quieres modificar
2. Selecciona la condición o tratamiento
3. Puedes marcar superficies específicas del diente
4. Guarda los cambios

### Comparar odontogramas:
- Puedes ver el historial de cambios
- Comparar snapshots anteriores

---

## 📦 GESTIÓN DE STOCK/INVENTARIO

### Ver el inventario:
1. Ve a "Inventario" en el menú lateral
2. Verás la lista de productos con cantidades actuales

### Añadir un producto nuevo:
1. Haz clic en "+ Nuevo Producto"
2. Completa nombre, categoría, cantidad inicial
3. Opcionalmente añade código de barras, proveedor, precio

### Registrar entrada de stock:
1. Selecciona el producto
2. Usa el botón "Añadir stock"
3. Indica la cantidad que entra

### Consumo de stock en citas:
- Durante una consulta activa, puedes registrar qué materiales se usaron
- El stock se descuenta automáticamente al confirmar

### Alertas de stock bajo:
- El sistema muestra alertas cuando un producto está por debajo del mínimo configurado

---

## 📧 MARKETING Y COMUNICACIONES

### Configurar email de la clínica:
1. Ve a Configuración > Email
2. Configura los datos SMTP (host, puerto, usuario, contraseña)
3. Prueba la conexión con el botón "Enviar email de prueba"

### Notificaciones automáticas:
- Se pueden activar recordatorios de citas por email/SMS
- Recordatorio 24h antes y 1h antes (configurables)

### Campañas de marketing:
1. Ve a Marketing > Campañas
2. Crea una nueva campaña
3. Diseña el email con el editor
4. Selecciona los destinatarios (segmentos de pacientes)
5. Programa o envía inmediatamente

### Felicitaciones de cumpleaños:
- Se pueden configurar emails automáticos de cumpleaños
- Ve a Marketing > Cumpleaños

---

## 👥 USUARIOS Y ROLES

### Tipos de roles:
- **Super Admin:** Acceso total al sistema, gestión de organizaciones
- **Admin:** Administrador de la clínica, acceso a configuración
- **Trabajador:** Personal de la clínica, acceso a funciones clínicas
- **Paciente:** Acceso limitado para ver sus propias citas

### Crear un nuevo trabajador:
1. Ve a Configuración > Trabajadores
2. Haz clic en "+ Nuevo Trabajador"
3. Completa los datos y asigna el rol

### Cambiar contraseña:
- El usuario puede ir a su Perfil (icono en la esquina superior derecha)
- Haz clic en "Cambiar contraseña"

### Recuperar contraseña:
- En la pantalla de login, haz clic en "¿Olvidaste tu contraseña?"
- Ingresa tu email
- Recibirás un correo con el enlace para restablecer

---

## ⚙️ CONFIGURACIÓN

### Configuración general:
- Ve a Configuración en el menú lateral
- Puedes modificar datos de la clínica, horarios, etc.

### Servicios/Tratamientos:
- Ve a Configuración > Servicios
- Añade, edita o elimina los tratamientos que ofrece la clínica
- Configura duración y precio de cada servicio

---

## 🔔 NOTIFICACIONES

### Tipos de notificaciones:
- Recordatorios de citas por email
- Recordatorios de citas por SMS
- Solicitudes de valoración post-consulta

### Configurar notificaciones:
1. Ve a Configuración > Email
2. Activa/desactiva los tipos de notificación que desees

---

## ❓ PREGUNTAS FRECUENTES

**¿Cómo cambio entre clínicas?**
Si tienes acceso a varias clínicas, usa el selector de clínica en la parte superior del menú lateral.

**¿Por qué no puedo mover una cita?**
Solo puedes mover citas en estado "Pendiente". Las completadas o canceladas están bloqueadas.

**¿Cómo veo el historial de un paciente?**
Ve al detalle del paciente y navega por las pestañas: Información, Citas, Odontograma, Historial.

**¿Los datos se guardan automáticamente?**
No, debes hacer clic en "Guardar" para confirmar los cambios.
`;

/**
 * Keywords that indicate the user is asking about personal data
 * These should trigger a rejection response
 */
const DATA_QUERY_PATTERNS = [
    /cu[aá]ntos?\s+pacientes?/i,
    /lista\s+de\s+pacientes?/i,
    /datos?\s+de[l]?\s+paciente/i,
    /informaci[oó]n\s+de[l]?\s+paciente/i,
    /email\s+de/i,
    /tel[eé]fono\s+de/i,
    /direcci[oó]n\s+de/i,
    /citas?\s+de\s+hoy/i,
    /citas?\s+de\s+ma[nñ]ana/i,
    /citas?\s+del?\s+paciente/i,
    /historial\s+de[l]?\s+paciente/i,
    /tratamientos?\s+de[l]?\s+paciente/i,
    /muestra\s+(los|las|el|la)/i,
    /dame\s+(los|las|el|la)/i,
    /qui[eé]n\s+tiene\s+cita/i,
    /pacientes?\s+(que|con)\s+/i,
];

/**
 * Check if the message is asking for actual data
 */
const isDataQuery = (message: string): boolean => {
    return DATA_QUERY_PATTERNS.some(pattern => pattern.test(message));
};

/**
 * Security rejection message
 */
const DATA_REJECTION_MESSAGE = `🔒 Lo siento, no puedo acceder a datos personales ni información de pacientes, citas o tratamientos específicos. 

Por seguridad y privacidad, solo puedo ayudarte con **preguntas sobre cómo usar la aplicación**.

Por ejemplo, puedo explicarte:
- 📋 Cómo crear o editar un paciente
- 📅 Cómo agendar una cita
- 🦷 Cómo usar el odontograma
- 📦 Cómo gestionar el inventario

¿En qué te puedo ayudar?`;

export interface AssistantMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatResponse {
    success: boolean;
    message?: string;
    error?: string;
}

/**
 * Send a message to the assistant and get a response
 */
export const chatWithAssistant = async (
    message: string,
    conversationHistory: AssistantMessage[] = [],
    clinicId?: string
): Promise<ChatResponse> => {
    try {
        // Enforce AI quota
        if (clinicId) {
            try {
                await AiUsageService.enforceQuota(clinicId);
            } catch (e: any) {
                return {
                    success: false,
                    error: e.message,
                };
            }
        }

        // Security check: reject data queries before sending to OpenAI
        if (isDataQuery(message)) {
            logger.info('Assistant rejected data query', { message: message.substring(0, 100) });
            return {
                success: true,
                message: DATA_REJECTION_MESSAGE,
            };
        }

        // Build messages array for OpenAI
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...conversationHistory.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
            })),
            { role: 'user', content: message },
        ];

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // Cost-effective for FAQ
            messages,
            max_tokens: 800,
            temperature: 0.7,
        });

        const assistantMessage = response.choices[0]?.message?.content;

        if (!assistantMessage) {
            throw new Error('No response from OpenAI');
        }

        logger.info('Assistant response generated', {
            userMessage: message.substring(0, 50),
            responseLength: assistantMessage.length
        });

        // Log AI usage
        if (clinicId) {
            const tokens = {
                prompt: response.usage?.prompt_tokens || 300,
                completion: response.usage?.completion_tokens || 200,
                total: response.usage?.total_tokens || 500,
            };
            await AiUsageService.logUsage(clinicId, 'assistant', 'gpt-4o-mini', tokens);
        }

        return {
            success: true,
            message: assistantMessage,
        };

    } catch (error: any) {
        logger.error('Assistant chat error', { error: error.message });
        return {
            success: false,
            error: 'Lo siento, hubo un error al procesar tu pregunta. Por favor, intenta de nuevo.',
        };
    }
};
