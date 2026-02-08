import type { Request } from 'express';
import type { Role } from './enums.js';
export * from './enums.js';
export interface AccessTokenPayload {
    userId: string;
    email: string;
    role: Role;
    organizationId: string | null;
    clinicId: string | null;
}
export interface RefreshTokenPayload {
    userId: string;
    tokenVersion: number;
}
export interface TenantContext {
    organizationId: string | null;
    clinicId: string | null;
    clinicIds: string[];
}
export interface AuthenticatedRequest extends Request {
    user: AccessTokenPayload;
    tenantContext: TenantContext;
}
export interface PaginationParams {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
}
export type ServiceResult<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: string;
    code?: string;
};
export interface AIRadiographAnalysis {
    id: string;
    radiographId: string;
    suspiciousAreas: SuspiciousArea[];
    summary: string;
    confidence: number;
    processingTimeMs: number;
    modelVersion: string;
    disclaimer: string;
}
export interface SuspiciousArea {
    id: string;
    type: 'caries' | 'lesion' | 'bone_loss' | 'fracture' | 'other';
    location: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    confidence: number;
    description: string;
    toothNumber?: number;
}
export interface VitalSigns {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
}
export interface Procedure {
    code: string;
    name: string;
    toothNumbers?: number[];
    notes?: string;
    cost?: number;
}
export interface ExportOptions {
    format: 'csv' | 'pdf' | 'xlsx';
    dateFrom?: Date;
    dateTo?: Date;
    includeFields?: string[];
}
//# sourceMappingURL=index.d.ts.map