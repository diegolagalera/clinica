/**
 * System Email Marketing Templates for Dental Clinics
 * These are pre-built templates that clinics can clone and customize
 */

export interface SystemTemplate {
    name: string;
    subject: string;
    category: 'birthday' | 'promo' | 'seasonal' | 'educational' | 'reactivation' | 'onboarding' | 'newsletter' | 'custom';
    previewText: string;
    designJson: object; // Unlayer design JSON
    htmlContent: string; // Pre-rendered HTML
}

// Variables disponibles en los templates
export const MARKETING_TEMPLATE_VARIABLES = {
    patient_name: 'Nombre del paciente',
    patient_first_name: 'Nombre (solo)',
    clinic_name: 'Nombre de la clínica',
    clinic_phone: 'Teléfono de la clínica',
    clinic_address: 'Dirección de la clínica',
    clinic_email: 'Email de la clínica',
    unsubscribe_url: 'Enlace para darse de baja',
};

// Helper para crear diseño Unlayer básico
const createBasicDesign = (bodyHtml: string, backgroundColor: string = '#f5f5f5') => ({
    counters: { u_column: 1, u_row: 1, u_content_text: 1 },
    body: {
        id: 'body',
        rows: [
            {
                id: 'row-1',
                cells: [1],
                columns: [
                    {
                        id: 'col-1',
                        contents: [
                            {
                                id: 'content-1',
                                type: 'text',
                                values: {
                                    text: bodyHtml,
                                    containerPadding: '20px',
                                },
                            },
                        ],
                    },
                ],
                values: {
                    backgroundColor: '#ffffff',
                    padding: '20px',
                },
            },
        ],
        values: {
            backgroundColor,
            contentWidth: '600px',
            fontFamily: { label: 'Arial', value: 'arial,helvetica,sans-serif' },
        },
    },
});

// Template HTML base con estilos
const wrapHtml = (content: string, bgColor: string = '#f5f5f5') => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; background-color: ${bgColor}; font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
        .content { padding: 30px; }
        .header { text-align: center; padding: 20px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        .button { display: inline-block; padding: 12px 30px; background: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; }
        h1 { color: #1f2937; margin-bottom: 20px; }
        p { color: #4b5563; line-height: 1.6; }
        .highlight { color: #3b82f6; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        ${content}
        <div class="footer">
            <p>{{clinic_name}} | {{clinic_phone}}</p>
            <p><a href="{{unsubscribe_url}}">Darse de baja de estos emails</a></p>
        </div>
    </div>
</body>
</html>
`;

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
    // 1. Feliz Cumpleaños 🎂
    {
        name: '🎂 Feliz Cumpleaños',
        subject: '🎂 ¡Feliz Cumpleaños, {{patient_first_name}}! - {{clinic_name}}',
        category: 'birthday',
        previewText: 'Te deseamos un maravilloso día y te tenemos un regalo especial',
        designJson: createBasicDesign(`
            <div style="text-align: center;">
                <h1 style="font-size: 32px;">🎂 ¡Feliz Cumpleaños!</h1>
                <p style="font-size: 18px;">Querido/a <strong>{{patient_first_name}}</strong>,</p>
                <p>Todo el equipo de <strong>{{clinic_name}}</strong> te desea un día lleno de alegría y sonrisas.</p>
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <p style="color: white; font-size: 20px; margin: 0;">🎁 Regalo especial de cumpleaños</p>
                    <p style="color: white; font-size: 16px;">10% de descuento en tu próximo tratamiento</p>
                </div>
                <p>Válido durante todo el mes de tu cumpleaños.</p>
                <p>¡Llámanos para reservar tu cita!</p>
            </div>
        `),
        htmlContent: wrapHtml(`
            <div class="content" style="text-align: center;">
                <h1 style="font-size: 32px;">🎂 ¡Feliz Cumpleaños!</h1>
                <p style="font-size: 18px;">Querido/a <strong>{{patient_first_name}}</strong>,</p>
                <p>Todo el equipo de <strong>{{clinic_name}}</strong> te desea un día lleno de alegría y sonrisas.</p>
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <p style="color: white; font-size: 20px; margin: 0;">🎁 Regalo especial de cumpleaños</p>
                    <p style="color: white; font-size: 16px;">10% de descuento en tu próximo tratamiento</p>
                </div>
                <p>Válido durante todo el mes de tu cumpleaños.</p>
                <p>¡Llámanos para reservar tu cita!</p>
                <p style="margin-top: 20px;"><a href="tel:{{clinic_phone}}" class="button">📞 Reservar cita</a></p>
            </div>
        `),
    },

    // 2. Navidad - Oferta Limpieza 🎄
    {
        name: '🎄 Navidad - Oferta Limpieza',
        subject: '🎄 ¡Oferta de Navidad! Limpieza dental con descuento - {{clinic_name}}',
        category: 'seasonal',
        previewText: 'Esta Navidad, regálate una sonrisa perfecta con nuestra oferta especial',
        designJson: createBasicDesign(`
            <div style="text-align: center;">
                <h1 style="color: #c41e3a;">🎄 ¡Felices Fiestas!</h1>
                <p>En <strong>{{clinic_name}}</strong> queremos que empieces el año con la mejor sonrisa.</p>
                <div style="background: #c41e3a; padding: 25px; border-radius: 10px; margin: 20px 0; color: white;">
                    <p style="font-size: 14px; margin: 0;">OFERTA ESPECIAL NAVIDAD</p>
                    <p style="font-size: 36px; font-weight: bold; margin: 10px 0;">-25%</p>
                    <p style="font-size: 18px; margin: 0;">en Limpieza Dental Profesional</p>
                </div>
                <p>Aprovecha esta oferta exclusiva hasta el 31 de enero.</p>
                <p style="color: #666;">*Promoción válida para nuevas reservas</p>
            </div>
        `),
        htmlContent: wrapHtml(`
            <div class="content" style="text-align: center;">
                <h1 style="color: #c41e3a;">🎄 ¡Felices Fiestas!</h1>
                <p>En <strong>{{clinic_name}}</strong> queremos que empieces el año con la mejor sonrisa.</p>
                <div style="background: #c41e3a; padding: 25px; border-radius: 10px; margin: 20px 0; color: white;">
                    <p style="font-size: 14px; margin: 0;">OFERTA ESPECIAL NAVIDAD</p>
                    <p style="font-size: 36px; font-weight: bold; margin: 10px 0;">-25%</p>
                    <p style="font-size: 18px; margin: 0;">en Limpieza Dental Profesional</p>
                </div>
                <p>Aprovecha esta oferta exclusiva hasta el 31 de enero.</p>
                <p><a href="tel:{{clinic_phone}}" class="button" style="background: #c41e3a;">Reservar ahora</a></p>
                <p style="color: #666; font-size: 12px;">*Promoción válida para nuevas reservas</p>
            </div>
        `),
    },

    // 3. Prevención de Caries 🦷
    {
        name: '🦷 Prevención de Caries',
        subject: '🦷 5 consejos para evitar las caries - {{clinic_name}}',
        category: 'educational',
        previewText: 'Mantén tu sonrisa sana con estos consejos de nuestros especialistas',
        designJson: createBasicDesign(`
            <div>
                <h1 style="text-align: center;">🦷 Cómo Prevenir las Caries</h1>
                <p>Hola <strong>{{patient_first_name}}</strong>,</p>
                <p>En <strong>{{clinic_name}}</strong> queremos ayudarte a mantener tu sonrisa sana. Aquí tienes 5 consejos esenciales:</p>
                <ol style="line-height: 2;">
                    <li><strong>Cepíllate 3 veces al día</strong> - Después de cada comida durante 2 minutos</li>
                    <li><strong>Usa hilo dental</strong> - Al menos una vez al día antes de dormir</li>
                    <li><strong>Limita el azúcar</strong> - Evita bebidas azucaradas y snacks entre comidas</li>
                    <li><strong>Visita al dentista</strong> - Revisiones cada 6 meses para detectar problemas a tiempo</li>
                    <li><strong>Usa flúor</strong> - Elige pasta dental con flúor y considera enjuagues</li>
                </ol>
                <p>¿Cuánto hace que no vienes a una revisión? ¡Te esperamos!</p>
            </div>
        `),
        htmlContent: wrapHtml(`
            <div class="content">
                <h1 style="text-align: center;">🦷 Cómo Prevenir las Caries</h1>
                <p>Hola <strong>{{patient_first_name}}</strong>,</p>
                <p>En <strong>{{clinic_name}}</strong> queremos ayudarte a mantener tu sonrisa sana. Aquí tienes 5 consejos esenciales:</p>
                <ol style="line-height: 2;">
                    <li><strong>Cepíllate 3 veces al día</strong> - Después de cada comida durante 2 minutos</li>
                    <li><strong>Usa hilo dental</strong> - Al menos una vez al día antes de dormir</li>
                    <li><strong>Limita el azúcar</strong> - Evita bebidas azucaradas y snacks entre comidas</li>
                    <li><strong>Visita al dentista</strong> - Revisiones cada 6 meses para detectar problemas a tiempo</li>
                    <li><strong>Usa flúor</strong> - Elige pasta dental con flúor y considera enjuagues</li>
                </ol>
                <p style="text-align: center; margin-top: 20px;">¿Cuánto hace que no vienes a una revisión?</p>
                <p style="text-align: center;"><a href="tel:{{clinic_phone}}" class="button">Reservar revisión</a></p>
            </div>
        `),
    },

    // 4. Blanqueamiento Dental ✨
    {
        name: '✨ Blanqueamiento Dental -20%',
        subject: '✨ Tu sonrisa más blanca con 20% dto - {{clinic_name}}',
        category: 'promo',
        previewText: 'Consigue una sonrisa radiante con nuestro tratamiento de blanqueamiento profesional',
        designJson: createBasicDesign(`
            <div style="text-align: center;">
                <h1>✨ Blanqueamiento Dental Profesional</h1>
                <p>Hola <strong>{{patient_first_name}}</strong>,</p>
                <p>¿Sueñas con una sonrisa más blanca y brillante?</p>
                <div style="background: linear-gradient(135deg, #00d4ff 0%, #00ff88 100%); padding: 25px; border-radius: 10px; margin: 20px 0;">
                    <p style="color: #1a1a1a; font-size: 28px; font-weight: bold; margin: 0;">-20% de descuento</p>
                    <p style="color: #1a1a1a; margin: 10px 0 0 0;">en tu tratamiento de blanqueamiento</p>
                </div>
                <p><strong>Resultados hasta 8 tonos más blancos</strong></p>
                <p>Tratamiento seguro y supervisado por profesionales</p>
                <p>Solo hasta fin de mes - ¡Reserva tu cita!</p>
            </div>
        `),
        htmlContent: wrapHtml(`
            <div class="content" style="text-align: center;">
                <h1>✨ Blanqueamiento Dental Profesional</h1>
                <p>Hola <strong>{{patient_first_name}}</strong>,</p>
                <p>¿Sueñas con una sonrisa más blanca y brillante?</p>
                <div style="background: linear-gradient(135deg, #00d4ff 0%, #00ff88 100%); padding: 25px; border-radius: 10px; margin: 20px 0;">
                    <p style="color: #1a1a1a; font-size: 28px; font-weight: bold; margin: 0;">-20% de descuento</p>
                    <p style="color: #1a1a1a; margin: 10px 0 0 0;">en tu tratamiento de blanqueamiento</p>
                </div>
                <p><strong>Resultados hasta 8 tonos más blancos</strong></p>
                <p>Tratamiento seguro y supervisado por profesionales</p>
                <p><a href="tel:{{clinic_phone}}" class="button" style="background: #10b981;">Reservar ahora</a></p>
                <p style="color: #666; font-size: 12px;">*Oferta válida hasta fin de mes</p>
            </div>
        `),
    },

    // 5. Te Echamos de Menos ⏰
    {
        name: '⏰ Te Echamos de Menos',
        subject: '⏰ {{patient_first_name}}, hace tiempo que no te vemos - {{clinic_name}}',
        category: 'reactivation',
        previewText: 'Tu salud dental es importante para nosotros. ¿Cuándo fue tu última revisión?',
        designJson: createBasicDesign(`
            <div style="text-align: center;">
                <h1>⏰ Te Echamos de Menos</h1>
                <p>Hola <strong>{{patient_first_name}}</strong>,</p>
                <p>En <strong>{{clinic_name}}</strong> nos hemos dado cuenta de que hace tiempo que no te visitamos.</p>
                <div style="background: #fef3c7; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                    <p style="color: #92400e; margin: 0;">⚠️ Los dentistas recomendamos una revisión cada 6 meses para prevenir problemas mayores.</p>
                </div>
                <p>Una revisión a tiempo puede:</p>
                <ul style="text-align: left; display: inline-block;">
                    <li>Detectar caries en etapa temprana</li>
                    <li>Prevenir enfermedades de las encías</li>
                    <li>Ahorrarte tratamientos costosos</li>
                </ul>
                <p style="font-size: 18px;"><strong>¡Te esperamos!</strong></p>
            </div>
        `),
        htmlContent: wrapHtml(`
            <div class="content" style="text-align: center;">
                <h1>⏰ Te Echamos de Menos</h1>
                <p>Hola <strong>{{patient_first_name}}</strong>,</p>
                <p>En <strong>{{clinic_name}}</strong> nos hemos dado cuenta de que hace tiempo que no te visitamos.</p>
                <div style="background: #fef3c7; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                    <p style="color: #92400e; margin: 0;">⚠️ Los dentistas recomendamos una revisión cada 6 meses para prevenir problemas mayores.</p>
                </div>
                <p>Una revisión a tiempo puede:</p>
                <ul style="text-align: left; display: inline-block;">
                    <li>Detectar caries en etapa temprana</li>
                    <li>Prevenir enfermedades de las encías</li>
                    <li>Ahorrarte tratamientos costosos</li>
                </ul>
                <p style="margin-top: 20px;"><a href="tel:{{clinic_phone}}" class="button">Reservar revisión</a></p>
            </div>
        `),
    },

    // 6. Ortodoncia Infantil 👶
    {
        name: '👶 Ortodoncia Infantil',
        subject: '👶 La ortodoncia de tu hijo - Guía gratuita - {{clinic_name}}',
        category: 'promo',
        previewText: 'Descubre cuándo es el mejor momento para la ortodoncia de tu hijo',
        designJson: createBasicDesign(`
            <div style="text-align: center;">
                <h1>👶 Ortodoncia Infantil</h1>
                <p style="font-size: 18px;">¿Cuándo es el momento adecuado?</p>
                <p>La Asociación Española de Ortodoncia recomienda la primera revisión a los <strong>7 años</strong>.</p>
                <div style="background: #e0f2fe; padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <p style="color: #0369a1; font-weight: bold; margin: 0 0 10px 0;">🎁 Primera consulta gratuita</p>
                    <p style="color: #0369a1; margin: 0;">Evaluación completa y plan personalizado</p>
                </div>
                <p><strong>Señales de que tu hijo puede necesitar ortodoncia:</strong></p>
                <ul style="text-align: left; display: inline-block;">
                    <li>Dientes apiñados o torcidos</li>
                    <li>Mordida cruzada o abierta</li>
                    <li>Dificultad al masticar</li>
                    <li>Respiración por la boca</li>
                </ul>
            </div>
        `),
        htmlContent: wrapHtml(`
            <div class="content" style="text-align: center;">
                <h1>👶 Ortodoncia Infantil</h1>
                <p style="font-size: 18px;">¿Cuándo es el momento adecuado?</p>
                <p>La Asociación Española de Ortodoncia recomienda la primera revisión a los <strong>7 años</strong>.</p>
                <div style="background: #e0f2fe; padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <p style="color: #0369a1; font-weight: bold; margin: 0 0 10px 0;">🎁 Primera consulta gratuita</p>
                    <p style="color: #0369a1; margin: 0;">Evaluación completa y plan personalizado</p>
                </div>
                <p><strong>Señales de que tu hijo puede necesitar ortodoncia:</strong></p>
                <ul style="text-align: left; display: inline-block;">
                    <li>Dientes apiñados o torcidos</li>
                    <li>Mordida cruzada o abierta</li>
                    <li>Dificultad al masticar</li>
                    <li>Respiración por la boca</li>
                </ul>
                <p style="margin-top: 20px;"><a href="tel:{{clinic_phone}}" class="button">Reservar consulta gratuita</a></p>
            </div>
        `),
    },

    // 7. Revisión Anual 📅
    {
        name: '📅 Revisión Anual',
        subject: '📅 Es hora de tu revisión dental anual - {{clinic_name}}',
        category: 'educational',
        previewText: 'No olvides tu revisión dental anual. Tu salud bucal te lo agradecerá',
        designJson: createBasicDesign(`
            <div style="text-align: center;">
                <h1>📅 Revisión Anual</h1>
                <p>Hola <strong>{{patient_first_name}}</strong>,</p>
                <p>Ha pasado un año desde tu última revisión dental completa.</p>
                <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #22c55e;">
                    <p style="color: #15803d; font-weight: bold; font-size: 18px; margin: 0;">✓ Tu revisión anual incluye:</p>
                    <ul style="text-align: left; color: #15803d; margin-top: 10px;">
                        <li>Exploración dental completa</li>
                        <li>Revisión de encías</li>
                        <li>Detección precoz de caries</li>
                        <li>Consejos personalizados</li>
                    </ul>
                </div>
                <p>Prevenir es mejor que curar. ¡Te esperamos!</p>
            </div>
        `),
        htmlContent: wrapHtml(`
            <div class="content" style="text-align: center;">
                <h1>📅 Revisión Anual</h1>
                <p>Hola <strong>{{patient_first_name}}</strong>,</p>
                <p>Ha pasado un año desde tu última revisión dental completa.</p>
                <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; margin: 20px 0; border: 2px solid #22c55e;">
                    <p style="color: #15803d; font-weight: bold; font-size: 18px; margin: 0;">✓ Tu revisión anual incluye:</p>
                    <ul style="text-align: left; color: #15803d; margin-top: 10px;">
                        <li>Exploración dental completa</li>
                        <li>Revisión de encías</li>
                        <li>Detección precoz de caries</li>
                        <li>Consejos personalizados</li>
                    </ul>
                </div>
                <p style="margin-top: 20px;"><a href="tel:{{clinic_phone}}" class="button" style="background: #22c55e;">Reservar revisión</a></p>
            </div>
        `),
    },

    // 8. Implantes Dentales 💎
    {
        name: '💎 Implantes Dentales',
        subject: '💎 Recupera tu sonrisa con implantes dentales - {{clinic_name}}',
        category: 'promo',
        previewText: 'Implantes de calidad con financiación sin intereses',
        designJson: createBasicDesign(`
            <div style="text-align: center;">
                <h1>💎 Implantes Dentales</h1>
                <p style="font-size: 18px;">Recupera tu sonrisa completa</p>
                <p>¿Has perdido algún diente? Los implantes dentales son la solución más duradera y natural.</p>
                <div style="background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%); padding: 25px; border-radius: 10px; margin: 20px 0; color: white;">
                    <p style="margin: 0;">Financiación hasta</p>
                    <p style="font-size: 32px; font-weight: bold; margin: 10px 0;">24 MESES</p>
                    <p style="margin: 0;">sin intereses</p>
                </div>
                <p><strong>Ventajas de los implantes:</strong></p>
                <ul style="text-align: left; display: inline-block;">
                    <li>Aspecto natural como un diente real</li>
                    <li>Duración de por vida con cuidado adecuado</li>
                    <li>Comodidad total al masticar</li>
                    <li>Previene pérdida ósea</li>
                </ul>
                <p>Consulta sin compromiso con nuestros especialistas</p>
            </div>
        `),
        htmlContent: wrapHtml(`
            <div class="content" style="text-align: center;">
                <h1>💎 Implantes Dentales</h1>
                <p style="font-size: 18px;">Recupera tu sonrisa completa</p>
                <p>¿Has perdido algún diente? Los implantes dentales son la solución más duradera y natural.</p>
                <div style="background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%); padding: 25px; border-radius: 10px; margin: 20px 0; color: white;">
                    <p style="margin: 0;">Financiación hasta</p>
                    <p style="font-size: 32px; font-weight: bold; margin: 10px 0;">24 MESES</p>
                    <p style="margin: 0;">sin intereses</p>
                </div>
                <p><strong>Ventajas de los implantes:</strong></p>
                <ul style="text-align: left; display: inline-block;">
                    <li>Aspecto natural como un diente real</li>
                    <li>Duración de por vida con cuidado adecuado</li>
                    <li>Comodidad total al masticar</li>
                    <li>Previene pérdida ósea</li>
                </ul>
                <p style="margin-top: 20px;"><a href="tel:{{clinic_phone}}" class="button">Consulta gratuita</a></p>
            </div>
        `),
    },

    // 9. Verano - Cuida tu Sonrisa 🏖️
    {
        name: '🏖️ Verano - Cuida tu Sonrisa',
        subject: '🏖️ Este verano, luce tu mejor sonrisa - {{clinic_name}}',
        category: 'seasonal',
        previewText: 'Consejos para cuidar tu sonrisa este verano + oferta especial',
        designJson: createBasicDesign(`
            <div style="text-align: center;">
                <h1>🏖️ Verano y Sonrisas</h1>
                <p>Hola <strong>{{patient_first_name}}</strong>,</p>
                <p>¡El verano está aquí! Prepara tu sonrisa para lucirla en vacaciones.</p>
                <div style="background: #fef9c3; padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <p style="color: #854d0e; font-weight: bold; margin: 0 0 10px 0;">☀️ Tips para este verano:</p>
                    <ul style="text-align: left; color: #854d0e; margin: 0;">
                        <li>Bebe mucha agua para mantener la boca hidratada</li>
                        <li>Evita morder hielo (daña el esmalte)</li>
                        <li>Usa protector labial con SPF</li>
                        <li>No olvides tu kit dental en vacaciones</li>
                    </ul>
                </div>
                <div style="background: #3b82f6; padding: 20px; border-radius: 10px; color: white;">
                    <p style="margin: 0; font-size: 18px;"><strong>Oferta de verano:</strong> Limpieza + Blanqueamiento</p>
                    <p style="margin: 5px 0 0 0; font-size: 24px;"><strong>-30%</strong></p>
                </div>
            </div>
        `),
        htmlContent: wrapHtml(`
            <div class="content" style="text-align: center;">
                <h1>🏖️ Verano y Sonrisas</h1>
                <p>Hola <strong>{{patient_first_name}}</strong>,</p>
                <p>¡El verano está aquí! Prepara tu sonrisa para lucirla en vacaciones.</p>
                <div style="background: #fef9c3; padding: 20px; border-radius: 10px; margin: 20px 0;">
                    <p style="color: #854d0e; font-weight: bold; margin: 0 0 10px 0;">☀️ Tips para este verano:</p>
                    <ul style="text-align: left; color: #854d0e; margin: 0;">
                        <li>Bebe mucha agua para mantener la boca hidratada</li>
                        <li>Evita morder hielo (daña el esmalte)</li>
                        <li>Usa protector labial con SPF</li>
                        <li>No olvides tu kit dental en vacaciones</li>
                    </ul>
                </div>
                <div style="background: #3b82f6; padding: 20px; border-radius: 10px; color: white; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 18px;"><strong>Oferta de verano:</strong> Limpieza + Blanqueamiento</p>
                    <p style="margin: 5px 0 0 0; font-size: 24px;"><strong>-30%</strong></p>
                </div>
                <p><a href="tel:{{clinic_phone}}" class="button" style="background: #f59e0b;">Reservar ahora</a></p>
            </div>
        `),
    },

    // 10. Bienvenida Nuevo Paciente 🆕
    {
        name: '🆕 Bienvenida Nuevo Paciente',
        subject: '🆕 ¡Bienvenido/a a {{clinic_name}}!',
        category: 'onboarding',
        previewText: 'Tu salud dental está en las mejores manos. Esto es lo que debes saber',
        designJson: createBasicDesign(`
            <div style="text-align: center;">
                <h1>🆕 ¡Bienvenido/a!</h1>
                <p style="font-size: 18px;">Hola <strong>{{patient_first_name}}</strong>,</p>
                <p>Nos alegra que hayas confiado en <strong>{{clinic_name}}</strong> para cuidar de tu sonrisa.</p>
                <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: left;">
                    <p style="font-weight: bold; margin: 0 0 10px 0;">📍 Cómo encontrarnos:</p>
                    <p style="margin: 0;">{{clinic_address}}</p>
                    <p style="margin: 10px 0 0 0;"><strong>📞 Teléfono:</strong> {{clinic_phone}}</p>
                </div>
                <p><strong>¿Qué esperar en tu primera visita?</strong></p>
                <ul style="text-align: left; display: inline-block;">
                    <li>Historia clínica completa</li>
                    <li>Exploración dental exhaustiva</li>
                    <li>Radiografía si es necesario</li>
                    <li>Plan de tratamiento personalizado</li>
                </ul>
                <p style="margin-top: 20px;">¡Te esperamos con una sonrisa!</p>
                <p style="font-style: italic; color: #666;">El equipo de {{clinic_name}}</p>
            </div>
        `),
        htmlContent: wrapHtml(`
            <div class="content" style="text-align: center;">
                <h1>🆕 ¡Bienvenido/a!</h1>
                <p style="font-size: 18px;">Hola <strong>{{patient_first_name}}</strong>,</p>
                <p>Nos alegra que hayas confiado en <strong>{{clinic_name}}</strong> para cuidar de tu sonrisa.</p>
                <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: left;">
                    <p style="font-weight: bold; margin: 0 0 10px 0;">📍 Cómo encontrarnos:</p>
                    <p style="margin: 0;">{{clinic_address}}</p>
                    <p style="margin: 10px 0 0 0;"><strong>📞 Teléfono:</strong> {{clinic_phone}}</p>
                </div>
                <p><strong>¿Qué esperar en tu primera visita?</strong></p>
                <ul style="text-align: left; display: inline-block;">
                    <li>Historia clínica completa</li>
                    <li>Exploración dental exhaustiva</li>
                    <li>Radiografía si es necesario</li>
                    <li>Plan de tratamiento personalizado</li>
                </ul>
                <p style="margin-top: 20px;">¡Te esperamos con una sonrisa!</p>
                <p style="font-style: italic; color: #666;">El equipo de {{clinic_name}}</p>
            </div>
        `),
    },
];

export default SYSTEM_TEMPLATES;
