import { db } from './index.js';
import { clinics, patients } from './schema.js';

// ============================================================================
// PATIENT SEED DATA — Realistic Spanish dental clinic patients
// ============================================================================

const firstNamesMale = [
    'Antonio', 'Manuel', 'José', 'Francisco', 'David',
    'Juan', 'Carlos', 'Jesús', 'Javier', 'Daniel',
    'Miguel', 'Rafael', 'Pedro', 'Pablo', 'Alejandro',
    'Fernando', 'Sergio', 'Luis', 'Alberto', 'Raúl',
    'Jorge', 'Andrés', 'Marcos', 'Diego', 'Víctor',
    'Iván', 'Óscar', 'Roberto', 'Enrique', 'Adrián',
];

const firstNamesFemale = [
    'María', 'Carmen', 'Ana', 'Laura', 'Isabel',
    'Marta', 'Cristina', 'Lucía', 'Elena', 'Rosa',
    'Pilar', 'Sara', 'Paula', 'Raquel', 'Andrea',
    'Beatriz', 'Patricia', 'Silvia', 'Nuria', 'Teresa',
    'Alicia', 'Inmaculada', 'Eva', 'Rocío', 'Sofía',
    'Clara', 'Julia', 'Irene', 'Alba', 'Natalia',
];

const lastNames = [
    'García', 'Rodríguez', 'Martínez', 'López', 'González',
    'Hernández', 'Pérez', 'Sánchez', 'Ramírez', 'Torres',
    'Flores', 'Rivera', 'Gómez', 'Díaz', 'Reyes',
    'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso',
    'Gutiérrez', 'Navarro', 'Domínguez', 'Vázquez', 'Ramos',
    'Gil', 'Serrano', 'Blanco', 'Molina', 'Morales',
    'Suárez', 'Ortega', 'Delgado', 'Castro', 'Ortiz',
    'Rubio', 'Marín', 'Núñez', 'Iglesias', 'Medina',
    'Jiménez', 'Ruiz', 'Fernández', 'Castillo', 'Santos',
    'Guerrero', 'Lozano', 'Cano', 'Méndez', 'Cruz',
];

const cities = [
    { city: 'Amposta', postalCode: '43870' },
    { city: 'Tortosa', postalCode: '43500' },
    { city: 'Tarragona', postalCode: '43001' },
    { city: 'Reus', postalCode: '43201' },
    { city: 'Deltebre', postalCode: '43580' },
    { city: 'Sant Carles de la Ràpita', postalCode: '43540' },
    { city: 'Vinaròs', postalCode: '12500' },
    { city: 'Benicarló', postalCode: '12580' },
    { city: 'L\'Aldea', postalCode: '43896' },
    { city: 'Alcanar', postalCode: '43530' },
    { city: 'Ulldecona', postalCode: '43550' },
    { city: 'La Sénia', postalCode: '43560' },
];

const streets = [
    'Calle Mayor', 'Avenida de Cataluña', 'Calle del Mar',
    'Paseo de la Estación', 'Calle San Juan', 'Plaza España',
    'Calle de la Iglesia', 'Avenida de la Constitución',
    'Calle Nou', 'Calle del Riu', 'Calle de les Flors',
    'Avenida de Sant Jaume', 'Calle del Sol', 'Passeig del Canal',
    'Calle de Montjuïc', 'Calle de la Pau', 'Rambla de Catalunya',
    'Calle de les Creus', 'Avenida dels Ametllers', 'Carrer de l\'Olivera',
];

const insuranceProviders = [
    'Adeslas', 'Sanitas', 'Asisa', 'DKV Seguros',
    'Mapfre Salud', 'AXA Salud', 'Cigna', 'Caser Seguros',
    null, null, null, null, // ~33% without insurance
];

const allergies = [
    null, null, null, null, null, null, null, // ~70% no allergies
    'Penicilina',
    'Lidocaína',
    'Látex',
    'Aspirina / AINEs',
    'Penicilina, Amoxicilina',
    'Látex, Yodo',
    'Metales (níquel)',
    'Anestésicos locales (articaína)',
];

const medicalHistories = [
    null, null, null, null, null, // ~50% no relevant history
    'Hipertensión arterial controlada con medicación',
    'Diabetes tipo 2 controlada',
    'Asma leve, usa inhalador de rescate',
    'Hipotiroidismo, toma levotiroxina',
    'Embarazo (segundo trimestre)',
    'Enfermedad celíaca',
    'Osteoporosis, toma bifosfonatos',
    'Marcapasos cardíaco',
    'Cardiopatía isquémica, toma anticoagulantes',
    'Epilepsia controlada con medicación',
];

// ============================================================================
// HELPERS
// ============================================================================

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateDNI(): string {
    const num = randomInt(10000000, 99999999);
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const letter = letters[num % 23];
    return `${num}${letter}`;
}

function generatePhone(): string {
    // Spanish mobile numbers: 6XX XXX XXX or 7XX XXX XXX
    const prefix = pick(['6', '7']);
    const rest = String(randomInt(10000000, 99999999));
    return `+34${prefix}${rest}`;
}

function generateDateOfBirth(): Date {
    // Ages between 3 and 90 years old
    const now = new Date();
    const age = randomInt(3, 90);
    const year = now.getFullYear() - age;
    const month = randomInt(0, 11);
    const day = randomInt(1, 28);
    return new Date(year, month, day);
}

function generateAddress(): string {
    const street = pick(streets);
    const num = randomInt(1, 150);
    const hasFloor = Math.random() > 0.4;
    if (hasFloor) {
        const floor = randomInt(1, 8);
        const door = pick(['A', 'B', 'C', 'D', 'Izq', 'Dcha']);
        return `${street}, ${num}, ${floor}º ${door}`;
    }
    return `${street}, ${num}`;
}

function generateInsuranceNumber(): string {
    return `${randomInt(100, 999)}-${randomInt(1000000, 9999999)}`;
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function seedPatients() {
    const TOTAL_PATIENTS = 50;

    console.log('👥 Starting patient seed...\n');

    try {
        // Get the first clinic
        const [clinic] = await db
            .select()
            .from(clinics)
            .limit(1);

        if (!clinic) {
            console.error('❌ No clinic found. Run the main seed first.');
            process.exit(1);
        }

        console.log(`📍 Using clinic: ${clinic.name} (${clinic.id})\n`);

        let created = 0;
        const usedDNIs = new Set<string>();
        const usedEmails = new Set<string>();

        for (let i = 0; i < TOTAL_PATIENTS; i++) {
            const isMale = Math.random() > 0.5;
            const gender = isMale ? 'male' : 'female';
            const firstName = isMale ? pick(firstNamesMale) : pick(firstNamesFemale);
            const lastName1 = pick(lastNames);
            const lastName2 = pick(lastNames);
            const fullLastName = `${lastName1} ${lastName2}`;

            // Unique DNI
            let dni = generateDNI();
            while (usedDNIs.has(dni)) dni = generateDNI();
            usedDNIs.add(dni);

            // Generate email (some patients may not have one)
            const hasEmail = Math.random() > 0.15; // 85% have email
            let email: string | null = null;
            if (hasEmail) {
                const base = `${firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.${lastName1.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`;
                email = `${base}${randomInt(1, 99)}@${pick(['gmail.com', 'hotmail.com', 'yahoo.es', 'outlook.com'])}`;
                // Ensure unique
                while (usedEmails.has(email)) {
                    email = `${base}${randomInt(100, 999)}@${pick(['gmail.com', 'hotmail.com', 'yahoo.es'])}`;
                }
                usedEmails.add(email);
            }

            const dob = generateDateOfBirth();
            const cityData = pick(cities);
            const insurance = pick(insuranceProviders);

            // Emergency contact (for minors or random adults)
            const age = new Date().getFullYear() - dob.getFullYear();
            const isMinor = age < 18;
            const hasEmergencyContact = isMinor || Math.random() > 0.6;

            await db.insert(patients).values({
                clinicId: clinic.id,
                firstName,
                lastName: fullLastName,
                email,
                phone: generatePhone(),
                dateOfBirth: dob,
                gender,
                idNumber: age >= 14 ? dni : null, // Minors under 14 may not have DNI
                address: generateAddress(),
                city: cityData.city,
                postalCode: cityData.postalCode,
                emergencyContact: hasEmergencyContact
                    ? `${pick(firstNamesMale)} ${pick(lastNames)}`
                    : null,
                emergencyPhone: hasEmergencyContact ? generatePhone() : null,
                allergies: pick(allergies),
                medicalHistory: pick(medicalHistories),
                notes: isMinor ? 'Paciente menor de edad, requiere acompañante' : null,
                insuranceProvider: insurance,
                insuranceNumber: insurance ? generateInsuranceNumber() : null,
                consentGiven: true,
                consentDate: new Date(),
                acceptsMarketing: Math.random() > 0.2,      // 80% accept marketing
                acceptsBirthdayEmails: Math.random() > 0.1,  // 90% accept birthday emails
                isActive: Math.random() > 0.05,              // 95% active
            });

            created++;
        }

        // Count stats
        console.log(`✅ Created ${created} patients\n`);
        console.log('========================================');
        console.log('🎉 Patient seed completed successfully!');
        console.log('========================================\n');
        console.log('📊 Summary:');
        console.log('----------------------------------------');
        console.log(`  Total patients: ${created}`);
        console.log(`  Clinic: ${clinic.name}`);
        console.log(`  Cities: ${cities.map(c => c.city).join(', ')}`);
        console.log('----------------------------------------');
        console.log('\n👤 Patient Configuration:');
        console.log('  Ages: 3 to 90 years');
        console.log('  ~85% have email');
        console.log('  ~33% have dental insurance');
        console.log('  ~30% have allergies listed');
        console.log('  ~50% have medical history');
        console.log('  ~80% accept marketing');
        console.log('  ~95% active');
        console.log('----------------------------------------\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Patient seed failed:', error);
        process.exit(1);
    }
}

seedPatients();
