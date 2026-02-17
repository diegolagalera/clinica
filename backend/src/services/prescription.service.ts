import { eq, desc, and } from 'drizzle-orm';
import { prescriptions, patients, users, clinics, staffProfiles, clinicMedications } from '../db/schema.js';
import type { Database } from '../db/index.js';
import { logger } from '../utils/logger.js';
import * as storage from './storage.service.js';
import PDFDocument from 'pdfkit';

// ============================================================================
// COMMON DENTAL MEDICATIONS CATALOG
// ============================================================================

export const COMMON_MEDICATIONS = [
    // Antibióticos
    { medication: 'Amoxicilina 750mg', category: 'Antibiótico', defaultDosage: '1 comprimido', defaultFrequency: 'Cada 8 horas', defaultDuration: '7 días' },
    { medication: 'Amoxicilina/Ác. Clavulánico 875/125mg', category: 'Antibiótico', defaultDosage: '1 comprimido', defaultFrequency: 'Cada 8 horas', defaultDuration: '7 días' },
    { medication: 'Clindamicina 300mg', category: 'Antibiótico', defaultDosage: '1 cápsula', defaultFrequency: 'Cada 8 horas', defaultDuration: '7 días' },
    { medication: 'Azitromicina 500mg', category: 'Antibiótico', defaultDosage: '1 comprimido', defaultFrequency: 'Cada 24 horas', defaultDuration: '3 días' },
    { medication: 'Metronidazol 500mg', category: 'Antibiótico', defaultDosage: '1 comprimido', defaultFrequency: 'Cada 8 horas', defaultDuration: '7 días' },
    // Antiinflamatorios
    { medication: 'Ibuprofeno 600mg', category: 'Antiinflamatorio', defaultDosage: '1 comprimido', defaultFrequency: 'Cada 8 horas', defaultDuration: '5 días' },
    { medication: 'Dexketoprofeno 25mg (Enantyum)', category: 'Antiinflamatorio', defaultDosage: '1 comprimido', defaultFrequency: 'Cada 8 horas', defaultDuration: '3-5 días' },
    { medication: 'Diclofenaco 50mg', category: 'Antiinflamatorio', defaultDosage: '1 comprimido', defaultFrequency: 'Cada 8 horas', defaultDuration: '5 días' },
    { medication: 'Naproxeno 550mg', category: 'Antiinflamatorio', defaultDosage: '1 comprimido', defaultFrequency: 'Cada 12 horas', defaultDuration: '5 días' },
    // Analgésicos
    { medication: 'Paracetamol 1g', category: 'Analgésico', defaultDosage: '1 comprimido', defaultFrequency: 'Cada 8 horas', defaultDuration: '3-5 días' },
    { medication: 'Metamizol 575mg (Nolotil)', category: 'Analgésico', defaultDosage: '1 cápsula', defaultFrequency: 'Cada 8 horas', defaultDuration: '3-5 días' },
    { medication: 'Tramadol 50mg', category: 'Analgésico', defaultDosage: '1 cápsula', defaultFrequency: 'Cada 8 horas', defaultDuration: '3 días' },
    // Corticoides
    { medication: 'Dexametasona 4mg', category: 'Corticoide', defaultDosage: '1 comprimido', defaultFrequency: 'Cada 12 horas', defaultDuration: '3 días' },
    { medication: 'Prednisona 30mg', category: 'Corticoide', defaultDosage: '1 comprimido', defaultFrequency: 'Cada 24 horas', defaultDuration: '5 días' },
    // Antisépticos
    { medication: 'Clorhexidina 0.12% (Colutorio)', category: 'Antiséptico', defaultDosage: '15ml', defaultFrequency: 'Cada 12 horas', defaultDuration: '7-14 días' },
    { medication: 'Clorhexidina 0.20% Gel', category: 'Antiséptico', defaultDosage: 'Aplicar en zona', defaultFrequency: 'Cada 8 horas', defaultDuration: '7 días' },
    // Antifúngicos
    { medication: 'Nistatina 100.000 UI/ml (Suspensión)', category: 'Antifúngico', defaultDosage: '5ml', defaultFrequency: 'Cada 6 horas', defaultDuration: '14 días' },
    { medication: 'Fluconazol 50mg', category: 'Antifúngico', defaultDosage: '1 cápsula', defaultFrequency: 'Cada 24 horas', defaultDuration: '7 días' },
    // Protectores gástricos
    { medication: 'Omeprazol 20mg', category: 'Protector gástrico', defaultDosage: '1 cápsula', defaultFrequency: 'Cada 24 horas (en ayunas)', defaultDuration: 'Mientras dure el tratamiento' },
];

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a prescription and generate PDF
 */
export const createPrescription = async (
    db: Database,
    data: {
        clinicId: string;
        patientId: string;
        prescribedById: string;
        items: { medication: string; dosage: string; frequency: string; duration: string; instructions?: string | undefined }[];
        diagnosis?: string | undefined;
        notes?: string | undefined;
    },
    tenantSlug?: string
) => {
    // Sanitize items: ensure instructions is never undefined (strip for exactOptionalPropertyTypes)
    const sanitizedItems = data.items.map(item => {
        const clean: { medication: string; dosage: string; frequency: string; duration: string; instructions?: string } = {
            medication: item.medication,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
        };
        if (item.instructions !== undefined) {
            clean.instructions = item.instructions;
        }
        return clean;
    });

    const result = await db
        .insert(prescriptions)
        .values({
            clinicId: data.clinicId,
            patientId: data.patientId,
            prescribedById: data.prescribedById,
            items: sanitizedItems,
            diagnosis: data.diagnosis || null,
            notes: data.notes || null,
        })
        .returning();

    const prescription = result[0];
    if (!prescription) {
        throw new Error('Failed to create prescription');
    }

    // 2. Fetch data for PDF generation
    const patient = await db.query.patients.findFirst({
        where: eq(patients.id, data.patientId),
    });
    const doctor = await db.query.users.findFirst({
        where: eq(users.id, data.prescribedById),
    });
    const doctorProfile = await db.query.staffProfiles.findFirst({
        where: eq(staffProfiles.userId, data.prescribedById),
    });
    const clinic = await db.query.clinics.findFirst({
        where: eq(clinics.id, data.clinicId),
    });

    if (!patient || !doctor || !clinic) {
        logger.error({ prescriptionId: prescription.id }, 'Missing data for PDF generation');
        return prescription;
    }

    // 3. Generate PDF
    try {
        const pdfBuffer = await generatePrescriptionPdf({
            prescription,
            patient,
            doctor,
            doctorProfile,
            clinic,
        });

        // 4. Upload to MinIO
        const storageKey = `prescriptions/${prescription.id}.pdf`;
        await storage.uploadFile(storageKey, pdfBuffer, 'application/pdf', tenantSlug);

        // 5. Update prescription with storage key
        await db
            .update(prescriptions)
            .set({ pdfStorageKey: storageKey })
            .where(eq(prescriptions.id, prescription.id));

        return { ...prescription, pdfStorageKey: storageKey };
    } catch (err) {
        logger.error({ err, prescriptionId: prescription.id }, 'Error generating prescription PDF');
        return prescription;
    }
};

/**
 * Get prescriptions for a patient
 */
export const getPrescriptionsByPatient = async (db: Database, patientId: string, clinicId: string) => {
    const results = await db
        .select({
            id: prescriptions.id,
            clinicId: prescriptions.clinicId,
            patientId: prescriptions.patientId,
            prescribedById: prescriptions.prescribedById,
            items: prescriptions.items,
            diagnosis: prescriptions.diagnosis,
            notes: prescriptions.notes,
            pdfStorageKey: prescriptions.pdfStorageKey,
            createdAt: prescriptions.createdAt,
            doctorFirstName: users.firstName,
            doctorLastName: users.lastName,
            doctorLicense: staffProfiles.licenseNumber,
        })
        .from(prescriptions)
        .leftJoin(users, eq(prescriptions.prescribedById, users.id))
        .leftJoin(staffProfiles, eq(users.id, staffProfiles.userId))
        .where(
            and(
                eq(prescriptions.patientId, patientId),
                eq(prescriptions.clinicId, clinicId)
            )
        )
        .orderBy(desc(prescriptions.createdAt));

    return results.map(r => ({
        id: r.id,
        clinicId: r.clinicId,
        patientId: r.patientId,
        items: r.items,
        diagnosis: r.diagnosis,
        notes: r.notes,
        pdfStorageKey: r.pdfStorageKey,
        createdAt: r.createdAt,
        prescribedBy: {
            id: r.prescribedById,
            firstName: r.doctorFirstName,
            lastName: r.doctorLastName,
            licenseNumber: r.doctorLicense,
        },
    }));
};

/**
 * Get a single prescription by ID
 */
export const getPrescriptionById = async (db: Database, id: string) => {
    const results = await db
        .select({
            id: prescriptions.id,
            clinicId: prescriptions.clinicId,
            patientId: prescriptions.patientId,
            prescribedById: prescriptions.prescribedById,
            items: prescriptions.items,
            diagnosis: prescriptions.diagnosis,
            notes: prescriptions.notes,
            pdfStorageKey: prescriptions.pdfStorageKey,
            createdAt: prescriptions.createdAt,
            doctorFirstName: users.firstName,
            doctorLastName: users.lastName,
        })
        .from(prescriptions)
        .leftJoin(users, eq(prescriptions.prescribedById, users.id))
        .where(eq(prescriptions.id, id))
        .limit(1);

    return results[0] || null;
};

/**
 * Delete a prescription
 */
export const deletePrescription = async (db: Database, id: string, clinicId: string, tenantSlug?: string) => {
    // Get the prescription first to clean up storage
    const prescription = await db.query.prescriptions.findFirst({
        where: and(eq(prescriptions.id, id), eq(prescriptions.clinicId, clinicId)),
    });

    if (!prescription) {
        throw new Error('Prescription not found');
    }

    // Delete PDF from storage if exists
    if (prescription.pdfStorageKey) {
        try {
            await storage.deleteFile(prescription.pdfStorageKey, tenantSlug);
        } catch (err) {
            logger.warn({ err, key: prescription.pdfStorageKey }, 'Failed to delete prescription PDF from storage');
        }
    }

    await db.delete(prescriptions).where(eq(prescriptions.id, id));
    return { deleted: true };
};

/**
 * Get medications catalog for a clinic (auto-seeds defaults if empty)
 */
export const getClinicMedications = async (db: Database, clinicId: string) => {
    const existing = await db
        .select()
        .from(clinicMedications)
        .where(and(
            eq(clinicMedications.clinicId, clinicId),
            eq(clinicMedications.isActive, true)
        ))
        .orderBy(clinicMedications.category, clinicMedications.medication);

    // Auto-seed if clinic has no medications yet
    if (existing.length === 0) {
        await seedDefaultMedications(db, clinicId);
        return db
            .select()
            .from(clinicMedications)
            .where(and(
                eq(clinicMedications.clinicId, clinicId),
                eq(clinicMedications.isActive, true)
            ))
            .orderBy(clinicMedications.category, clinicMedications.medication);
    }

    return existing;
};

/**
 * Seed default medications for a clinic
 */
const seedDefaultMedications = async (db: Database, clinicId: string) => {
    const values = COMMON_MEDICATIONS.map(m => ({
        clinicId,
        medication: m.medication,
        category: m.category,
        defaultDosage: m.defaultDosage,
        defaultFrequency: m.defaultFrequency,
        defaultDuration: m.defaultDuration,
    }));
    await db.insert(clinicMedications).values(values);
};

/**
 * Create a custom medication
 */
export const createMedication = async (
    db: Database,
    data: {
        clinicId: string;
        medication: string;
        category: string;
        defaultDosage: string;
        defaultFrequency: string;
        defaultDuration: string;
    }
) => {
    const [med] = await db.insert(clinicMedications).values(data).returning();
    return med;
};

/**
 * Update a medication
 */
export const updateMedication = async (
    db: Database,
    id: string,
    clinicId: string,
    data: Partial<{
        medication: string | undefined;
        category: string | undefined;
        defaultDosage: string | undefined;
        defaultFrequency: string | undefined;
        defaultDuration: string | undefined;
    }>
) => {
    const [updated] = await db
        .update(clinicMedications)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(clinicMedications.id, id), eq(clinicMedications.clinicId, clinicId)))
        .returning();
    return updated;
};

/**
 * Soft-delete a medication
 */
export const deleteMedication = async (db: Database, id: string, clinicId: string) => {
    await db
        .update(clinicMedications)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(clinicMedications.id, id), eq(clinicMedications.clinicId, clinicId)));
    return { deleted: true };
};

// ============================================================================
// PDF GENERATION
// ============================================================================

interface PdfData {
    prescription: typeof prescriptions.$inferSelect;
    patient: typeof patients.$inferSelect;
    doctor: typeof users.$inferSelect;
    doctorProfile: typeof staffProfiles.$inferSelect | null | undefined;
    clinic: typeof clinics.$inferSelect;
}

const generatePrescriptionPdf = async (data: PdfData): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 50, bottom: 50, left: 50, right: 50 },
            });

            const chunks: Buffer[] = [];
            doc.on('data', (chunk: Buffer) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const { prescription, patient, doctor, doctorProfile, clinic } = data;
            const pageWidth = 595.28 - 100; // A4 width minus margins

            // ── Header ──
            doc.fontSize(16).font('Helvetica-Bold')
                .text(clinic.name, { align: 'center' });

            if (clinic.address) {
                doc.fontSize(9).font('Helvetica')
                    .text(clinic.address, { align: 'center' });
            }
            const contactParts = [clinic.phone, clinic.email].filter(Boolean);
            if (contactParts.length > 0) {
                doc.fontSize(9).text(contactParts.join(' · '), { align: 'center' });
            }

            // Divider
            doc.moveDown(0.5);
            doc.strokeColor('#CBD5E1')
                .lineWidth(1)
                .moveTo(50, doc.y)
                .lineTo(50 + pageWidth, doc.y)
                .stroke();

            // ── Title ──
            doc.moveDown(1);
            doc.fontSize(14).font('Helvetica-Bold')
                .fillColor('#1E293B')
                .text('RECETA MÉDICA PRIVADA', { align: 'center' });

            // ── Date ──
            doc.moveDown(0.5);
            const createdAt = prescription.createdAt instanceof Date
                ? prescription.createdAt
                : new Date(prescription.createdAt);
            doc.fontSize(10).font('Helvetica')
                .fillColor('#64748B')
                .text(`Fecha: ${createdAt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid' })}`, { align: 'right' });

            // ── Patient info ──
            doc.moveDown(1);
            doc.fontSize(10).font('Helvetica-Bold')
                .fillColor('#1E293B')
                .text('DATOS DEL PACIENTE');
            doc.moveDown(0.3);
            doc.fontSize(10).font('Helvetica')
                .fillColor('#334155')
                .text(`Nombre: ${patient.firstName} ${patient.lastName}`);
            if (patient.idNumber) {
                doc.text(`DNI/NIE: ${patient.idNumber}`);
            }
            if (patient.dateOfBirth) {
                const dob = patient.dateOfBirth instanceof Date
                    ? patient.dateOfBirth
                    : new Date(patient.dateOfBirth);
                const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
                doc.text(`Fecha de nacimiento: ${dob.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })} (${age} años)`);
            }

            // ── Diagnosis ──
            if (prescription.diagnosis) {
                doc.moveDown(0.8);
                doc.fontSize(10).font('Helvetica-Bold')
                    .fillColor('#1E293B')
                    .text('DIAGNÓSTICO');
                doc.moveDown(0.3);
                doc.fontSize(10).font('Helvetica')
                    .fillColor('#334155')
                    .text(prescription.diagnosis);
            }

            // ── Medications ──
            doc.moveDown(1);
            doc.strokeColor('#CBD5E1').lineWidth(0.5)
                .moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
            doc.moveDown(0.5);

            doc.fontSize(11).font('Helvetica-Bold')
                .fillColor('#1E293B')
                .text('Rp/');
            doc.moveDown(0.5);

            const items = prescription.items as { medication: string; dosage: string; frequency: string; duration: string; instructions?: string }[];

            items.forEach((item, idx) => {
                doc.fontSize(10).font('Helvetica-Bold')
                    .fillColor('#0F172A')
                    .text(`${idx + 1}. ${item.medication}`);

                doc.fontSize(9).font('Helvetica')
                    .fillColor('#475569')
                    .text(`   ${item.dosage} — ${item.frequency} — ${item.duration}`);

                if (item.instructions) {
                    doc.fontSize(9).font('Helvetica-Oblique')
                        .fillColor('#64748B')
                        .text(`   ${item.instructions}`);
                }
                doc.moveDown(0.4);
            });

            // ── Additional notes ──
            if (prescription.notes) {
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica-Bold')
                    .fillColor('#1E293B')
                    .text('INDICACIONES ADICIONALES');
                doc.moveDown(0.3);
                doc.fontSize(9).font('Helvetica')
                    .fillColor('#334155')
                    .text(prescription.notes);
            }

            // ── Footer: Doctor signature ──
            doc.moveDown(2);
            doc.strokeColor('#CBD5E1').lineWidth(0.5)
                .moveTo(50, doc.y).lineTo(50 + pageWidth, doc.y).stroke();
            doc.moveDown(1);

            // Signature image
            if (doctorProfile?.signatureImage) {
                try {
                    // signatureImage is base64 data URI: data:image/png;base64,...
                    const base64Data = doctorProfile.signatureImage.replace(/^data:image\/\w+;base64,/, '');
                    const sigBuffer = Buffer.from(base64Data, 'base64');
                    const sigY = doc.y;
                    doc.image(sigBuffer, doc.x, sigY, { width: 150, height: 60 });
                    // Move cursor explicitly below the signature image + padding
                    doc.y = sigY + 60 + 12;
                } catch (err) {
                    logger.warn({ err }, 'Failed to embed signature image in PDF');
                }
            } else {
                // Reserve blank space for manual signature
                const sigLineY = doc.y + 50;
                doc.strokeColor('#94A3B8').lineWidth(0.5)
                    .moveTo(doc.x, sigLineY)
                    .lineTo(doc.x + 180, sigLineY)
                    .stroke();
                doc.fontSize(7).font('Helvetica')
                    .fillColor('#94A3B8')
                    .text('Firma', doc.x, sigLineY + 4, { width: 180, align: 'center' });
                doc.y = sigLineY + 20;
            }

            doc.fontSize(10).font('Helvetica-Bold')
                .fillColor('#1E293B')
                .text(`Dr/a. ${doctor.firstName} ${doctor.lastName}`);

            if (doctorProfile?.licenseNumber) {
                doc.fontSize(9).font('Helvetica')
                    .fillColor('#64748B')
                    .text(`Nº Colegiado: ${doctorProfile.licenseNumber}`);
            }

            // ── Legal disclaimer ──
            doc.moveDown(2);
            doc.fontSize(7).font('Helvetica-Oblique')
                .fillColor('#94A3B8')
                .text(
                    'Receta médica privada. Válida únicamente con firma del facultativo. ' +
                    'Conservar fuera del alcance de los niños. Seguir las indicaciones del profesional sanitario.',
                    { align: 'center' }
                );

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};
