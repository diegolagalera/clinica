import type { Request } from 'express';
import type { Role } from './enums.js';
import type { Database } from '../db/index.js';

// Re-export enums
export * from './enums.js';

// JWT token payloads
export interface AccessTokenPayload {
    userId: string;
    email: string;
    role: Role;
    organizationId: string | null;
    clinicId: string | null;
    tenantSlug?: string | undefined; // For resolving tenant DB without central lookup
}

export interface RefreshTokenPayload {
    userId: string;
    tokenVersion: number;
    jti?: string; // Unique JWT ID to prevent duplicate tokens
}

// Multi-tenant context attached to requests
export interface TenantContext {
    organizationId: string | null;
    clinicId: string | null;
    clinicIds: string[]; // For users with access to multiple clinics
}

// Extended Express Request with auth and tenant context
export interface AuthenticatedRequest extends Request {
    user: AccessTokenPayload;
    tenantContext: TenantContext;
    db: Database; // Tenant-specific database connection
}

// Pagination
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

// API Response wrapper
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
}

// Service layer result types
export type ServiceResult<T> =
    | { success: true; data: T }
    | { success: false; error: string; code?: string };

// AI Analysis result structure
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

// Clinical record types
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

// Export request types
export interface ExportOptions {
    format: 'csv' | 'pdf' | 'xlsx';
    dateFrom?: Date;
    dateTo?: Date;
    includeFields?: string[];
}
