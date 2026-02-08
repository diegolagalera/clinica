"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSnapshot = exports.getSnapshot = exports.getSnapshots = exports.createSnapshot = exports.updateToothNotes = exports.updateOdontogramNotes = exports.getOdontogramHistory = exports.getToothHistory = exports.updateToothCondition = exports.getOdontogramByPatientId = exports.getOrCreateOdontogram = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const index_js_1 = require("../db/index.js");
const schema_js_1 = require("../db/schema.js");
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
const DEFAULT_SURFACES = {
    mesial: 'HEALTHY',
    distal: 'HEALTHY',
    occlusal: 'HEALTHY',
    vestibular: 'HEALTHY',
    palatino: 'HEALTHY',
};
/**
 * Get or create odontogram for a patient
 */
const getOrCreateOdontogram = async (patientId, clinicId, isChild = false, _tenantContext) => {
    // Check if odontogram already exists
    const existing = await index_js_1.db.query.odontograms.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.odontograms.patientId, patientId),
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
                generalCondition: (t.generalCondition || 'HEALTHY'),
                surfaces: (t.surfaces || DEFAULT_SURFACES),
            })),
        };
    }
    // Create new odontogram
    const [newOdontogram] = await index_js_1.db
        .insert(schema_js_1.odontograms)
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
        generalCondition: 'HEALTHY',
        surfaces: DEFAULT_SURFACES,
    }));
    const createdTeeth = await index_js_1.db.insert(schema_js_1.odontogramTeeth).values(teethData).returning();
    return {
        ...newOdontogram,
        isChild: newOdontogram.isChild ?? false,
        teeth: createdTeeth.map((t) => ({
            ...t,
            generalCondition: (t.generalCondition || 'HEALTHY'),
            surfaces: (t.surfaces || DEFAULT_SURFACES),
        })),
    };
};
exports.getOrCreateOdontogram = getOrCreateOdontogram;
/**
 * Get odontogram by patient ID
 */
const getOdontogramByPatientId = async (patientId, _tenantContext) => {
    const result = await index_js_1.db.query.odontograms.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_1.odontograms.patientId, patientId),
        with: {
            teeth: true,
        },
    });
    if (!result)
        return null;
    return {
        ...result,
        isChild: result.isChild ?? false,
        teeth: (result.teeth || []).map((t) => ({
            ...t,
            generalCondition: (t.generalCondition || 'HEALTHY'),
            surfaces: (t.surfaces || DEFAULT_SURFACES),
        })),
    };
};
exports.getOdontogramByPatientId = getOdontogramByPatientId;
/**
 * Update tooth condition
 */
const updateToothCondition = async (odontogramId, toothNumber, condition, surface, // null = update general condition
userId, notes) => {
    // Get current tooth state
    const currentTooth = await index_js_1.db.query.odontogramTeeth.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.odontogramTeeth.odontogramId, odontogramId), (0, drizzle_orm_1.eq)(schema_js_1.odontogramTeeth.toothNumber, toothNumber)),
    });
    if (!currentTooth) {
        throw new Error(`Tooth ${toothNumber} not found in odontogram`);
    }
    const previousCondition = surface
        ? (currentTooth.surfaces?.[surface] || 'HEALTHY')
        : (currentTooth.generalCondition || 'HEALTHY');
    // Prepare update data
    let updateData = {
        updatedAt: new Date(),
    };
    if (surface) {
        // Update specific surface
        const currentSurfaces = (currentTooth.surfaces || DEFAULT_SURFACES);
        updateData.surfaces = {
            ...currentSurfaces,
            [surface]: condition,
        };
    }
    else {
        // Update general condition
        updateData.generalCondition = condition;
    }
    // Update tooth
    const [updatedTooth] = await index_js_1.db
        .update(schema_js_1.odontogramTeeth)
        .set(updateData)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.odontogramTeeth.odontogramId, odontogramId), (0, drizzle_orm_1.eq)(schema_js_1.odontogramTeeth.toothNumber, toothNumber)))
        .returning();
    // Record history
    await index_js_1.db.insert(schema_js_1.odontogramHistory).values({
        odontogramId,
        toothNumber,
        surface: surface || null,
        previousCondition: previousCondition,
        newCondition: condition,
        changedById: userId,
        notes,
    });
    // Update odontogram last updated
    await index_js_1.db
        .update(schema_js_1.odontograms)
        .set({
        lastUpdatedById: userId,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.odontograms.id, odontogramId));
    return {
        ...updatedTooth,
        generalCondition: (updatedTooth.generalCondition || 'HEALTHY'),
        surfaces: (updatedTooth.surfaces || DEFAULT_SURFACES),
    };
};
exports.updateToothCondition = updateToothCondition;
/**
 * Get tooth history
 */
const getToothHistory = async (odontogramId, toothNumber) => {
    const history = await index_js_1.db.query.odontogramHistory.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.odontogramHistory.odontogramId, odontogramId), (0, drizzle_orm_1.eq)(schema_js_1.odontogramHistory.toothNumber, toothNumber)),
        orderBy: [(0, drizzle_orm_1.desc)(schema_js_1.odontogramHistory.createdAt)],
    });
    return history;
};
exports.getToothHistory = getToothHistory;
/**
 * Get full odontogram history
 */
const getOdontogramHistory = async (odontogramId, limit = 50) => {
    const history = await index_js_1.db.query.odontogramHistory.findMany({
        where: (0, drizzle_orm_1.eq)(schema_js_1.odontogramHistory.odontogramId, odontogramId),
        orderBy: [(0, drizzle_orm_1.desc)(schema_js_1.odontogramHistory.createdAt)],
        limit,
    });
    return history;
};
exports.getOdontogramHistory = getOdontogramHistory;
/**
 * Update odontogram notes
 */
const updateOdontogramNotes = async (odontogramId, notes, userId) => {
    await index_js_1.db
        .update(schema_js_1.odontograms)
        .set({
        notes,
        lastUpdatedById: userId,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.odontograms.id, odontogramId));
};
exports.updateOdontogramNotes = updateOdontogramNotes;
/**
 * Update tooth notes
 */
const updateToothNotes = async (odontogramId, toothNumber, notes) => {
    await index_js_1.db
        .update(schema_js_1.odontogramTeeth)
        .set({
        notes,
        updatedAt: new Date(),
    })
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.odontogramTeeth.odontogramId, odontogramId), (0, drizzle_orm_1.eq)(schema_js_1.odontogramTeeth.toothNumber, toothNumber)));
};
exports.updateToothNotes = updateToothNotes;
// ============================================================================
// SNAPSHOTS
// ============================================================================
const schema_js_2 = require("../db/schema.js");
/**
 * Create a snapshot of current odontogram state
 */
const createSnapshot = async (odontogramId, name, description, userId) => {
    // Get current teeth state
    const teeth = await index_js_1.db.query.odontogramTeeth.findMany({
        where: (0, drizzle_orm_1.eq)(schema_js_1.odontogramTeeth.odontogramId, odontogramId),
    });
    const teethState = teeth.map((t) => ({
        toothNumber: t.toothNumber,
        generalCondition: t.generalCondition,
        surfaces: t.surfaces,
        notes: t.notes,
    }));
    const [snapshot] = await index_js_1.db
        .insert(schema_js_2.odontogramSnapshots)
        .values({
        odontogramId,
        name,
        description,
        teethState,
        createdById: userId,
    })
        .returning();
    return snapshot;
};
exports.createSnapshot = createSnapshot;
/**
 * Get all snapshots for an odontogram
 */
const getSnapshots = async (odontogramId) => {
    const snapshots = await index_js_1.db.query.odontogramSnapshots.findMany({
        where: (0, drizzle_orm_1.eq)(schema_js_2.odontogramSnapshots.odontogramId, odontogramId),
        orderBy: [(0, drizzle_orm_1.desc)(schema_js_2.odontogramSnapshots.createdAt)],
    });
    return snapshots;
};
exports.getSnapshots = getSnapshots;
/**
 * Get a single snapshot
 */
const getSnapshot = async (snapshotId) => {
    const snapshot = await index_js_1.db.query.odontogramSnapshots.findFirst({
        where: (0, drizzle_orm_1.eq)(schema_js_2.odontogramSnapshots.id, snapshotId),
    });
    return snapshot;
};
exports.getSnapshot = getSnapshot;
/**
 * Delete a snapshot
 */
const deleteSnapshot = async (snapshotId) => {
    await index_js_1.db.delete(schema_js_2.odontogramSnapshots).where((0, drizzle_orm_1.eq)(schema_js_2.odontogramSnapshots.id, snapshotId));
};
exports.deleteSnapshot = deleteSnapshot;
//# sourceMappingURL=odontogram.service.js.map