import { db } from './index.js';
import { sql } from 'drizzle-orm';
import { organizations, clinics, users, staffProfiles, patients } from './schema.js';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

async function seed() {
    console.log('🌱 Starting database seed...');

    try {
        // Enable unaccent extension for accent-insensitive search
        console.log('Enabling unaccent extension...');
        await db.execute(sql`CREATE EXTENSION IF NOT EXISTS unaccent`);
        console.log('✅ unaccent extension enabled');

        // Hash passwords
        const passwordHash = await bcrypt.hash('password123', SALT_ROUNDS);

        // 1. Create Super Admin (platform owner)
        console.log('Creating Super Admin...');
        const [superAdmin] = await db.insert(users).values({
            email: 'superadmin@dentalerp.com',
            passwordHash,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'SUPERADMIN',
            emailVerified: true,
            isActive: true,
        }).returning();
        console.log(`✅ Super Admin created: ${superAdmin!.email}`);

        // 2. Create Organization
        console.log('Creating Organization...');
        const [organization] = await db.insert(organizations).values({
            name: 'Clínicas Dentales Madrid',
            slug: 'clinicas-madrid',
            email: 'info@clinicasmadrid.com',
            phone: '+34 912 345 678',
            address: 'Calle Gran Vía 123, Madrid',
            isActive: true,
        }).returning();
        console.log(`✅ Organization created: ${organization!.name}`);

        // 3. Create Clinic
        console.log('Creating Clinic...');
        const [clinic] = await db.insert(clinics).values({
            organizationId: organization!.id,
            name: 'Clínica Dental Centro',
            slug: 'centro',
            email: 'centro@clinicasmadrid.com',
            phone: '+34 912 345 679',
            address: 'Calle Sol 45',
            city: 'Madrid',
            postalCode: '28013',
            country: 'ES',
            timezone: 'Europe/Madrid',
            isActive: true,
        }).returning();
        console.log(`✅ Clinic created: ${clinic!.name}`);

        // 4. Create Admin (organization admin)
        console.log('Creating Admin...');
        const [admin] = await db.insert(users).values({
            email: 'admin@clinicasmadrid.com',
            passwordHash,
            firstName: 'Admin',
            lastName: 'Clínica',
            phone: '+34 666 111 222',
            role: 'ADMIN',
            organizationId: organization!.id,
            clinicId: clinic!.id,
            emailVerified: true,
            isActive: true,
        }).returning();
        console.log(`✅ Admin created: ${admin!.email}`);

        // 5. Create Worker (dentist)
        console.log('Creating Worker...');
        const [worker] = await db.insert(users).values({
            email: 'doctor@clinicasmadrid.com',
            passwordHash,
            firstName: 'Juan',
            lastName: 'Pérez García',
            phone: '+34 666 333 444',
            role: 'WORKER',
            organizationId: organization!.id,
            clinicId: clinic!.id,
            emailVerified: true,
            isActive: true,
        }).returning();

        // Create staff profile for worker
        await db.insert(staffProfiles).values({
            userId: worker!.id,
            licenseNumber: 'COL-28-12345',
            specialty: 'Odontología General',
            bio: 'Especialista en odontología general con 10 años de experiencia.',
            color: '#0ea5e9',
        });
        console.log(`✅ Worker created: ${worker!.email}`);

        // 6. Create Patient User
        console.log('Creating Patient User...');
        const [patientUser] = await db.insert(users).values({
            email: 'paciente@email.com',
            passwordHash,
            firstName: 'María',
            lastName: 'García López',
            phone: '+34 666 555 666',
            role: 'USER',
            organizationId: organization!.id,
            clinicId: clinic!.id,
            emailVerified: true,
            isActive: true,
        }).returning();

        // Create patient record linked to user
        await db.insert(patients).values({
            clinicId: clinic!.id,
            userId: patientUser!.id,
            firstName: 'María',
            lastName: 'García López',
            email: 'paciente@email.com',
            phone: '+34 666 555 666',
            dateOfBirth: new Date('1990-05-15'),
            gender: 'female',
            idNumber: '12345678A',
            address: 'Calle Mayor 10, 2ºB',
            city: 'Madrid',
            postalCode: '28001',
            consentGiven: true,
            consentDate: new Date(),
            isActive: true,
        });
        console.log(`✅ Patient created: ${patientUser!.email}`);

        // 7. Create additional test patients (without user accounts)
        console.log('Creating additional patients...');
        await db.insert(patients).values([
            {
                clinicId: clinic!.id,
                firstName: 'Carlos',
                lastName: 'Ruiz Martínez',
                email: 'carlos.ruiz@email.com',
                phone: '+34 677 888 999',
                dateOfBirth: new Date('1985-03-22'),
                gender: 'male',
                consentGiven: true,
                consentDate: new Date(),
                isActive: true,
            },
            {
                clinicId: clinic!.id,
                firstName: 'Ana',
                lastName: 'Martínez Sánchez',
                email: 'ana.martinez@email.com',
                phone: '+34 688 777 666',
                dateOfBirth: new Date('1978-11-08'),
                gender: 'female',
                consentGiven: true,
                consentDate: new Date(),
                isActive: true,
            },
        ]);
        console.log(`✅ Additional patients created`);

        console.log('\n========================================');
        console.log('🎉 Database seeded successfully!');
        console.log('========================================\n');
        console.log('📧 Test Users:');
        console.log('----------------------------------------');
        console.log('SUPERADMIN:');
        console.log('  Email: superadmin@dentalerp.com');
        console.log('  Password: password123');
        console.log('----------------------------------------');
        console.log('ADMIN:');
        console.log('  Email: admin@clinicasmadrid.com');
        console.log('  Password: password123');
        console.log('----------------------------------------');
        console.log('WORKER (Doctor):');
        console.log('  Email: doctor@clinicasmadrid.com');
        console.log('  Password: password123');
        console.log('----------------------------------------');
        console.log('PATIENT:');
        console.log('  Email: paciente@email.com');
        console.log('  Password: password123');
        console.log('----------------------------------------\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
}

seed();
