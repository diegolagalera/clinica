import { TenantContext } from '../types/index.js';
export type DentalCondition = 'HEALTHY' | 'CARIES' | 'FILLING' | 'CROWN' | 'EXTRACTION_INDICATED' | 'MISSING' | 'IMPLANT' | 'ROOT_CANAL' | 'FRACTURE' | 'BRIDGE' | 'VENEER' | 'SEALANT';
export interface ToothSurfaces {
    mesial: DentalCondition;
    distal: DentalCondition;
    occlusal: DentalCondition;
    vestibular: DentalCondition;
    palatino: DentalCondition;
}
export interface OdontogramTooth {
    id: string;
    odontogramId: string;
    toothNumber: number;
    generalCondition: DentalCondition;
    surfaces: ToothSurfaces;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface Odontogram {
    id: string;
    clinicId: string;
    patientId: string;
    isChild: boolean;
    notes: string | null;
    lastUpdatedById: string | null;
    createdAt: Date;
    updatedAt: Date;
    teeth?: OdontogramTooth[];
}
/**
 * Get or create odontogram for a patient
 */
export declare const getOrCreateOdontogram: (patientId: string, clinicId: string, isChild: boolean | undefined, _tenantContext: TenantContext) => Promise<Odontogram>;
/**
 * Get odontogram by patient ID
 */
export declare const getOdontogramByPatientId: (patientId: string, _tenantContext: TenantContext) => Promise<Odontogram | null>;
/**
 * Update tooth condition
 */
export declare const updateToothCondition: (odontogramId: string, toothNumber: number, condition: DentalCondition, surface: keyof ToothSurfaces | null, // null = update general condition
userId: string, notes?: string) => Promise<OdontogramTooth>;
/**
 * Get tooth history
 */
export declare const getToothHistory: (odontogramId: string, toothNumber: number) => Promise<Array<{
    id: string;
    surface: string | null;
    previousCondition: string | null;
    newCondition: string;
    changedById: string;
    notes: string | null;
    createdAt: Date;
}>>;
/**
 * Get full odontogram history
 */
export declare const getOdontogramHistory: (odontogramId: string, limit?: number) => Promise<Array<{
    id: string;
    toothNumber: number;
    surface: string | null;
    previousCondition: string | null;
    newCondition: string;
    changedById: string;
    notes: string | null;
    createdAt: Date;
}>>;
/**
 * Update odontogram notes
 */
export declare const updateOdontogramNotes: (odontogramId: string, notes: string, userId: string) => Promise<void>;
/**
 * Update tooth notes
 */
export declare const updateToothNotes: (odontogramId: string, toothNumber: number, notes: string) => Promise<void>;
export interface OdontogramSnapshot {
    id: string;
    odontogramId: string;
    name: string;
    description: string | null;
    teethState: unknown;
    createdById: string;
    createdAt: Date;
}
/**
 * Create a snapshot of current odontogram state
 */
export declare const createSnapshot: (odontogramId: string, name: string, description: string | null, userId: string) => Promise<OdontogramSnapshot>;
/**
 * Get all snapshots for an odontogram
 */
export declare const getSnapshots: (odontogramId: string) => Promise<OdontogramSnapshot[]>;
/**
 * Get a single snapshot
 */
export declare const getSnapshot: (snapshotId: string) => Promise<OdontogramSnapshot | null>;
/**
 * Delete a snapshot
 */
export declare const deleteSnapshot: (snapshotId: string) => Promise<void>;
//# sourceMappingURL=odontogram.service.d.ts.map