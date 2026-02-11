import { eq, and, desc, sql, gte, lte, isNotNull, lt, gt, or, inArray } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { audienceSegments, patients } from '../db/schema.js';
import { logger } from '../utils/logger.js';

interface SegmentFilter {
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'between' | 'contains' | 'is_true' | 'is_false';
    value: any;
    value2?: any; // For 'between' operator
}

interface CreateSegmentData {
    name: string;
    description?: string;
    filters: SegmentFilter[];
}

interface UpdateSegmentData {
    name?: string;
    description?: string;
    filters?: SegmentFilter[];
    isActive?: boolean;
}

interface PatientPreview {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
}

class AudienceService {
    /**
     * Get all audience segments for a clinic
     */
    async getSegments(db: Database, clinicId: string) {
        return db
            .select()
            .from(audienceSegments)
            .where(eq(audienceSegments.clinicId, clinicId))
            .orderBy(desc(audienceSegments.createdAt));
    }

    /**
     * Get a specific segment by ID
     */
    async getSegmentById(db: Database, id: string, clinicId: string) {
        const [segment] = await db
            .select()
            .from(audienceSegments)
            .where(
                and(
                    eq(audienceSegments.id, id),
                    eq(audienceSegments.clinicId, clinicId)
                )
            )
            .limit(1);

        return segment || null;
    }

    /**
     * Create a new audience segment
     */
    async createSegment(db: Database, clinicId: string, userId: string, data: CreateSegmentData) {
        // Calculate initial patient count
        const count = await this.countPatientsForFilters(db, clinicId, data.filters);

        const [segment] = await db
            .insert(audienceSegments)
            .values({
                clinicId,
                createdById: userId,
                name: data.name,
                description: data.description || null,
                filters: data.filters,
                patientCount: count,
                isActive: true,
            })
            .returning();

        logger.info(`Audience segment created: ${segment!.id} for clinic ${clinicId}`);
        return segment;
    }

    /**
     * Update a segment
     */
    async updateSegment(db: Database, id: string, clinicId: string, data: UpdateSegmentData) {
        let patientCount: number | undefined;

        // If filters changed, recalculate patient count
        if (data.filters) {
            patientCount = await this.countPatientsForFilters(db, clinicId, data.filters);
        }

        const [updated] = await db
            .update(audienceSegments)
            .set({
                ...data,
                ...(patientCount !== undefined && { patientCount }),
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(audienceSegments.id, id),
                    eq(audienceSegments.clinicId, clinicId)
                )
            )
            .returning();

        if (!updated) {
            throw new Error('Segment not found');
        }

        logger.info(`Audience segment updated: ${id}`);
        return updated;
    }

    /**
     * Delete a segment
     */
    async deleteSegment(db: Database, id: string, clinicId: string) {
        const result = await db
            .delete(audienceSegments)
            .where(
                and(
                    eq(audienceSegments.id, id),
                    eq(audienceSegments.clinicId, clinicId)
                )
            )
            .returning();

        if (result.length === 0) {
            throw new Error('Segment not found');
        }

        logger.info(`Audience segment deleted: ${id}`);
        return true;
    }

    /**
     * Preview patients matching a set of filters
     */
    async previewFilters(db: Database, clinicId: string, filters: SegmentFilter[], limit: number = 10): Promise<{
        count: number;
        patients: PatientPreview[];
    }> {
        const count = await this.countPatientsForFilters(db, clinicId, filters);
        const matchingPatients = await this.getPatientsForFilters(db, clinicId, filters, limit);

        return {
            count,
            patients: matchingPatients.map(p => ({
                id: p.id,
                firstName: p.firstName,
                lastName: p.lastName,
                email: p.email,
            })),
        };
    }

    /**
     * Get all patients matching a segment
     */
    async getPatientsForSegment(db: Database, segmentId: string, clinicId: string) {
        const segment = await this.getSegmentById(db, segmentId, clinicId);
        if (!segment) {
            throw new Error('Segment not found');
        }

        const filters = segment.filters as SegmentFilter[];
        return this.getPatientsForFilters(db, clinicId, filters);
    }

    /**
     * Count patients matching filters
     */
    private async countPatientsForFilters(db: Database, clinicId: string, filters: SegmentFilter[]): Promise<number> {
        const conditions = this.buildFilterConditions(clinicId, filters);

        const [result] = await db
            .select({ count: sql<number>`count(*)` })
            .from(patients)
            .where(and(...conditions));

        return Number(result?.count || 0);
    }

    /**
     * Get patients matching filters
     */
    private async getPatientsForFilters(db: Database, clinicId: string, filters: SegmentFilter[], limit?: number) {
        const conditions = this.buildFilterConditions(clinicId, filters);

        let query = db
            .select()
            .from(patients)
            .where(and(...conditions))
            .orderBy(desc(patients.createdAt));

        if (limit) {
            query = query.limit(limit) as typeof query;
        }

        return query;
    }

    /**
     * Build SQL conditions from filters
     */
    private buildFilterConditions(clinicId: string, filters: SegmentFilter[]) {
        const conditions: any[] = [
            eq(patients.clinicId, clinicId),
            eq(patients.isActive, true),
        ];

        for (const filter of filters) {
            const condition = this.filterToCondition(filter);
            if (condition) {
                conditions.push(condition);
            }
        }

        return conditions;
    }

    /**
     * Convert a single filter to a SQL condition
     */
    private filterToCondition(filter: SegmentFilter) {
        switch (filter.field) {
            // Marketing preferences
            case 'acceptsMarketing':
                return filter.operator === 'is_true'
                    ? eq(patients.acceptsMarketing, true)
                    : eq(patients.acceptsMarketing, false);

            case 'acceptsBirthdayEmails':
                return filter.operator === 'is_true'
                    ? eq(patients.acceptsBirthdayEmails, true)
                    : eq(patients.acceptsBirthdayEmails, false);

            // Has email
            case 'hasEmail':
                return filter.operator === 'is_true'
                    ? and(isNotNull(patients.email), sql`${patients.email} != ''`)
                    : or(sql`${patients.email} IS NULL`, sql`${patients.email} = ''`);

            // Gender
            case 'gender':
                return eq(patients.gender, filter.value);

            // Age (calculated from dateOfBirth)
            case 'age':
                const today = new Date();
                if (filter.operator === 'between' && filter.value && filter.value2) {
                    const minBirthDate = new Date(today.getFullYear() - filter.value2, today.getMonth(), today.getDate());
                    const maxBirthDate = new Date(today.getFullYear() - filter.value, today.getMonth(), today.getDate());
                    return and(
                        gte(patients.dateOfBirth, minBirthDate),
                        lte(patients.dateOfBirth, maxBirthDate)
                    );
                } else if (filter.operator === 'greater_than') {
                    const maxDate = new Date(today.getFullYear() - filter.value, today.getMonth(), today.getDate());
                    return lt(patients.dateOfBirth, maxDate);
                } else if (filter.operator === 'less_than') {
                    const minDate = new Date(today.getFullYear() - filter.value, today.getMonth(), today.getDate());
                    return gt(patients.dateOfBirth, minDate);
                }
                break;

            // Birthday month
            case 'birthdayMonth':
                return sql`EXTRACT(MONTH FROM ${patients.dateOfBirth}) = ${filter.value}`;

            // Days since last visit
            case 'daysSinceLastVisit':
                logger.warn('daysSinceLastVisit filter requires special handling');
                break;

            // City
            case 'city':
                if (filter.operator === 'equals') {
                    return eq(patients.city, filter.value);
                } else if (filter.operator === 'contains') {
                    return sql`LOWER(${patients.city}) LIKE LOWER(${'%' + filter.value + '%'})`;
                }
                break;

            default:
                logger.warn(`Unknown filter field: ${filter.field}`);
        }

        return null;
    }

    /**
     * Get predefined filter options for the UI
     */
    getAvailableFilters() {
        return [
            {
                field: 'acceptsMarketing',
                label: 'Acepta marketing',
                operators: ['is_true', 'is_false'],
                valueType: 'boolean',
            },
            {
                field: 'acceptsBirthdayEmails',
                label: 'Acepta emails de cumpleaños',
                operators: ['is_true', 'is_false'],
                valueType: 'boolean',
            },
            {
                field: 'hasEmail',
                label: 'Tiene email',
                operators: ['is_true', 'is_false'],
                valueType: 'boolean',
            },
            {
                field: 'gender',
                label: 'Género',
                operators: ['equals'],
                valueType: 'select',
                options: [
                    { value: 'M', label: 'Masculino' },
                    { value: 'F', label: 'Femenino' },
                ],
            },
            {
                field: 'age',
                label: 'Edad',
                operators: ['between', 'greater_than', 'less_than'],
                valueType: 'number',
            },
            {
                field: 'birthdayMonth',
                label: 'Mes de cumpleaños',
                operators: ['equals'],
                valueType: 'select',
                options: [
                    { value: 1, label: 'Enero' },
                    { value: 2, label: 'Febrero' },
                    { value: 3, label: 'Marzo' },
                    { value: 4, label: 'Abril' },
                    { value: 5, label: 'Mayo' },
                    { value: 6, label: 'Junio' },
                    { value: 7, label: 'Julio' },
                    { value: 8, label: 'Agosto' },
                    { value: 9, label: 'Septiembre' },
                    { value: 10, label: 'Octubre' },
                    { value: 11, label: 'Noviembre' },
                    { value: 12, label: 'Diciembre' },
                ],
            },
            {
                field: 'city',
                label: 'Ciudad',
                operators: ['equals', 'contains'],
                valueType: 'text',
            },
        ];
    }

    /**
     * Refresh patient count for a segment
     */
    async refreshSegmentCount(db: Database, segmentId: string, clinicId: string) {
        const segment = await this.getSegmentById(db, segmentId, clinicId);
        if (!segment) {
            throw new Error('Segment not found');
        }

        const filters = segment.filters as SegmentFilter[];
        const count = await this.countPatientsForFilters(db, clinicId, filters);

        await db
            .update(audienceSegments)
            .set({
                patientCount: count,
                updatedAt: new Date(),
            })
            .where(eq(audienceSegments.id, segmentId));

        return count;
    }
}

export const audienceService = new AudienceService();
