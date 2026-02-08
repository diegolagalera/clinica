import { clinicalRecords } from '../db/schema.js';
import type { PaginationParams, ServiceResult } from '../types/index.js';
export interface CreateClinicalRecordInput {
    clinicId: string;
    patientId: string;
    appointmentId?: string;
    createdById: string;
    recordType: string;
    title?: string;
    content?: string;
    vitalSigns?: Record<string, unknown>;
    procedures?: Array<Record<string, unknown>>;
    diagnosis?: string;
    treatment?: string;
    prescriptions?: Array<Record<string, unknown>>;
    toothChart?: Record<string, unknown>;
    attachments?: Array<Record<string, unknown>>;
}
export interface UpdateClinicalRecordInput {
    title?: string;
    content?: string;
    vitalSigns?: Record<string, unknown>;
    procedures?: Array<Record<string, unknown>>;
    diagnosis?: string;
    treatment?: string;
    prescriptions?: Array<Record<string, unknown>>;
    toothChart?: Record<string, unknown>;
    attachments?: Array<Record<string, unknown>>;
}
export type ClinicalRecordType = typeof clinicalRecords.$inferSelect;
/**
 * Get clinical records by patient
 */
export declare const getRecordsByPatient: (patientId: string, clinicId: string, params: PaginationParams, filters?: {
    recordType?: string;
    search?: string;
}) => Promise<{
    data: any[];
    total: number;
}>;
/**
 * Get clinical records by clinic
 */
export declare const getRecordsByClinic: (clinicId: string, params: PaginationParams, filters?: {
    recordType?: string;
    search?: string;
    patientId?: string;
}) => Promise<{
    data: any[];
    total: number;
}>;
/**
 * Get clinical record by ID
 */
export declare const getRecordById: (id: string, clinicId: string) => Promise<any | null>;
/**
 * Create a clinical record
 */
export declare const createRecord: (input: CreateClinicalRecordInput) => Promise<ServiceResult<ClinicalRecordType>>;
/**
 * Update a clinical record
 */
export declare const updateRecord: (id: string, clinicId: string, input: UpdateClinicalRecordInput) => Promise<ServiceResult<any>>;
/**
 * Sign a clinical record (makes it immutable)
 */
export declare const signRecord: (id: string, clinicId: string, signedById: string) => Promise<ServiceResult<any>>;
/**
 * Delete a clinical record (only if not signed)
 */
export declare const deleteRecord: (id: string, clinicId: string) => Promise<boolean>;
/**
 * Get record types (for dropdowns)
 */
export declare const getRecordTypes: () => {
    value: string;
    label: string;
}[];
//# sourceMappingURL=clinical-record.service.d.ts.map