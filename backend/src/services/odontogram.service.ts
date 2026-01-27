import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
    odontograms,
    odontogramTeeth,
    odontogramHistory,
} from '../db/schema.js';
import { TenantContext } from '../types/index.js';

// Define types
export type DentalCondition =
    | 'HEALTHY'
    | 'CARIES'
    | 'FILLING'
    | 'CROWN'
    | 'EXTRACTION_INDICATED'
    | 'MISSING'
    | 'IMPLANT'
    | 'ROOT_CANAL'
    | 'FRACTURE'
    | 'BRIDGE'
    | 'VENEER'
    | 'SEALANT';

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

// FDI tooth numbers for adult (32 teeth) and child (20 teeth)
const ADULT_TEETH = [
    // Upper right (1st quadrant)
    18, 17, 16, 15, 14, 13, 12, 11,
    // Upper left (2nd quadrant)
    21, 22, 23, 24, 25, 26, 27, 28,
    // Lower left (3rd quadrant)
    38, 37, 36, 35, 34, 33, 32, 31,
    // Lower right (4th quadrant)
    41, 42, 43, 44, 45, 46, 47, 48,
];

const CHILD_TEETH = [
    // Upper right (5th quadrant)
    55, 54, 53, 52, 51,
    // Upper left (6th quadrant)
    61, 62, 63, 64, 65,
    // Lower left (7th quadrant)
    75, 74, 73, 72, 71,
    // Lower right (8th quadrant)
    81, 82, 83, 84, 85,
];

const DEFAULT_SURFACES: ToothSurfaces = {
    mesial: 'HEALTHY',
    distal: 'HEALTHY',
    occlusal: 'HEALTHY',
    vestibular: 'HEALTHY',
    palatino: 'HEALTHY',
};

/**
 * Get or create odontogram for a patient
 */
export const getOrCreateOdontogram = async (
    patientId: string,
    clinicId: string,
    isChild: boolean = false,
    _tenantContext: TenantContext
): Promise<Odontogram> => {
    // Check if odontogram already exists
    const existing = await db.query.odontograms.findFirst({
        where: eq(odontograms.patientId, patientId),
        with: {
            teeth: true,
        },
    });

    if (existing) {
        return {
            ...existing,
            isChild: existing.isChild ?? false,
            teeth: (existing.teeth || []).map((t) => ({
                ...t,
                generalCondition: (t.generalCondition || 'HEALTHY') as DentalCondition,
                surfaces: (t.surfaces || DEFAULT_SURFACES) as ToothSurfaces,
            })),
        };
    }

    // Create new odontogram
    const [newOdontogram] = await db
        .insert(odontograms)
        .values({
            clinicId,
            patientId,
            isChild,
        })
        .returning();

    // Initialize all teeth
    const teethNumbers = isChild ? CHILD_TEETH : ADULT_TEETH;
    const teethData = teethNumbers.map((toothNumber) => ({
        odontogramId: newOdontogram.id,
        toothNumber,
        generalCondition: 'HEALTHY' as const,
        surfaces: DEFAULT_SURFACES,
    }));

    const createdTeeth = await db.insert(odontogramTeeth).values(teethData).returning();

    return {
        ...newOdontogram,
        isChild: newOdontogram.isChild ?? false,
        teeth: createdTeeth.map((t) => ({
            ...t,
            generalCondition: (t.generalCondition || 'HEALTHY') as DentalCondition,
            surfaces: (t.surfaces || DEFAULT_SURFACES) as ToothSurfaces,
        })),
    };
};

/**
 * Get odontogram by patient ID
 */
export const getOdontogramByPatientId = async (
    patientId: string,
    _tenantContext: TenantContext
): Promise<Odontogram | null> => {
    const result = await db.query.odontograms.findFirst({
        where: eq(odontograms.patientId, patientId),
        with: {
            teeth: true,
        },
    });

    if (!result) return null;

    return {
        ...result,
        isChild: result.isChild ?? false,
        teeth: (result.teeth || []).map((t) => ({
            ...t,
            generalCondition: (t.generalCondition || 'HEALTHY') as DentalCondition,
            surfaces: (t.surfaces || DEFAULT_SURFACES) as ToothSurfaces,
        })),
    };
};

/**
 * Update tooth condition
 */
export const updateToothCondition = async (
    odontogramId: string,
    toothNumber: number,
    condition: DentalCondition,
    surface: keyof ToothSurfaces | null, // null = update general condition
    userId: string,
    notes?: string
): Promise<OdontogramTooth> => {
    // Get current tooth state
    const currentTooth = await db.query.odontogramTeeth.findFirst({
        where: and(
            eq(odontogramTeeth.odontogramId, odontogramId),
            eq(odontogramTeeth.toothNumber, toothNumber)
        ),
    });

    if (!currentTooth) {
        throw new Error(`Tooth ${toothNumber} not found in odontogram`);
    }

    const previousCondition = surface
        ? ((currentTooth.surfaces as ToothSurfaces)?.[surface] || 'HEALTHY')
        : (currentTooth.generalCondition || 'HEALTHY');

    // Prepare update data
    let updateData: Record<string, unknown> = {
        updatedAt: new Date(),
    };

    if (surface) {
        // Update specific surface
        const currentSurfaces = (currentTooth.surfaces || DEFAULT_SURFACES) as ToothSurfaces;
        updateData.surfaces = {
            ...currentSurfaces,
            [surface]: condition,
        };
    } else {
        // Update general condition
        updateData.generalCondition = condition;
    }

    // Update tooth
    const [updatedTooth] = await db
        .update(odontogramTeeth)
        .set(updateData)
        .where(
            and(
                eq(odontogramTeeth.odontogramId, odontogramId),
                eq(odontogramTeeth.toothNumber, toothNumber)
            )
        )
        .returning();

    // Record history
    await db.insert(odontogramHistory).values({
        odontogramId,
        toothNumber,
        surface: surface || null,
        previousCondition: previousCondition as string,
        newCondition: condition,
        changedById: userId,
        notes,
    });

    // Update odontogram last updated
    await db
        .update(odontograms)
        .set({
            lastUpdatedById: userId,
            updatedAt: new Date(),
        })
        .where(eq(odontograms.id, odontogramId));

    return {
        ...updatedTooth,
        generalCondition: (updatedTooth.generalCondition || 'HEALTHY') as DentalCondition,
        surfaces: (updatedTooth.surfaces || DEFAULT_SURFACES) as ToothSurfaces,
    };
};

/**
 * Get tooth history
 */
export const getToothHistory = async (
    odontogramId: string,
    toothNumber: number
): Promise<Array<{
    id: string;
    surface: string | null;
    previousCondition: string | null;
    newCondition: string;
    changedById: string;
    notes: string | null;
    createdAt: Date;
}>> => {
    const history = await db.query.odontogramHistory.findMany({
        where: and(
            eq(odontogramHistory.odontogramId, odontogramId),
            eq(odontogramHistory.toothNumber, toothNumber)
        ),
        orderBy: [desc(odontogramHistory.createdAt)],
    });

    return history;
};

/**
 * Get full odontogram history
 */
export const getOdontogramHistory = async (
    odontogramId: string,
    limit: number = 50
): Promise<Array<{
    id: string;
    toothNumber: number;
    surface: string | null;
    previousCondition: string | null;
    newCondition: string;
    changedById: string;
    notes: string | null;
    createdAt: Date;
}>> => {
    const history = await db.query.odontogramHistory.findMany({
        where: eq(odontogramHistory.odontogramId, odontogramId),
        orderBy: [desc(odontogramHistory.createdAt)],
        limit,
    });

    return history;
};

/**
 * Update odontogram notes
 */
export const updateOdontogramNotes = async (
    odontogramId: string,
    notes: string,
    userId: string
): Promise<void> => {
    await db
        .update(odontograms)
        .set({
            notes,
            lastUpdatedById: userId,
            updatedAt: new Date(),
        })
        .where(eq(odontograms.id, odontogramId));
};

/**
 * Update tooth notes
 */
export const updateToothNotes = async (
    odontogramId: string,
    toothNumber: number,
    notes: string
): Promise<void> => {
    await db
        .update(odontogramTeeth)
        .set({
            notes,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(odontogramTeeth.odontogramId, odontogramId),
                eq(odontogramTeeth.toothNumber, toothNumber)
            )
        );
};

// ============================================================================
// SNAPSHOTS
// ============================================================================

import { odontogramSnapshots } from '../db/schema.js';

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
export const createSnapshot = async (
    odontogramId: string,
    name: string,
    description: string | null,
    userId: string
): Promise<OdontogramSnapshot> => {
    // Get current teeth state
    const teeth = await db.query.odontogramTeeth.findMany({
        where: eq(odontogramTeeth.odontogramId, odontogramId),
    });

    const teethState = teeth.map((t) => ({
        toothNumber: t.toothNumber,
        generalCondition: t.generalCondition,
        surfaces: t.surfaces,
        notes: t.notes,
    }));

    const [snapshot] = await db
        .insert(odontogramSnapshots)
        .values({
            odontogramId,
            name,
            description,
            teethState,
            createdById: userId,
        })
        .returning();

    return snapshot as OdontogramSnapshot;
};

/**
 * Get all snapshots for an odontogram
 */
export const getSnapshots = async (
    odontogramId: string
): Promise<OdontogramSnapshot[]> => {
    const snapshots = await db.query.odontogramSnapshots.findMany({
        where: eq(odontogramSnapshots.odontogramId, odontogramId),
        orderBy: [desc(odontogramSnapshots.createdAt)],
    });

    return snapshots as OdontogramSnapshot[];
};

/**
 * Get a single snapshot
 */
export const getSnapshot = async (
    snapshotId: string
): Promise<OdontogramSnapshot | null> => {
    const snapshot = await db.query.odontogramSnapshots.findFirst({
        where: eq(odontogramSnapshots.id, snapshotId),
    });

    return snapshot as OdontogramSnapshot | null;
};

/**
 * Delete a snapshot
 */
export const deleteSnapshot = async (snapshotId: string): Promise<void> => {
    await db.delete(odontogramSnapshots).where(eq(odontogramSnapshots.id, snapshotId));
};
