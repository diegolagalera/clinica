// User roles in the system
export enum Role {
    SUPERADMIN = 'SUPERADMIN',
    ADMIN = 'ADMIN',
    WORKER = 'WORKER',
    USER = 'USER',
}

// Appointment types
export enum AppointmentType {
    VISIT = 'VISIT',
    SURGERY = 'SURGERY',
    REVIEW = 'REVIEW',
    EMERGENCY = 'EMERGENCY',
    FOLLOWUP = 'FOLLOWUP',
}

// Appointment status
export enum AppointmentStatus {
    SCHEDULED = 'SCHEDULED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    NO_SHOW = 'NO_SHOW',
}

// Radiograph AI analysis status
export enum AIAnalysisStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    REVIEWED = 'REVIEWED',
    REJECTED = 'REJECTED',
}

// Stock movement types
export enum StockMovementType {
    IN = 'IN',
    OUT = 'OUT',
    ADJUSTMENT = 'ADJUSTMENT',
    EXPIRED = 'EXPIRED',
}

// Invoice status
export enum InvoiceStatus {
    DRAFT = 'DRAFT',
    SENT = 'SENT',
    PAID = 'PAID',
    PARTIAL = 'PARTIAL',
    OVERDUE = 'OVERDUE',
    CANCELLED = 'CANCELLED',
}

// Payment methods
export enum PaymentMethod {
    CASH = 'CASH',
    CARD = 'CARD',
    TRANSFER = 'TRANSFER',
    INSURANCE = 'INSURANCE',
    OTHER = 'OTHER',
}

// Audit action types
export enum AuditAction {
    CREATE = 'CREATE',
    READ = 'READ',
    UPDATE = 'UPDATE',
    DELETE = 'DELETE',
    LOGIN = 'LOGIN',
    LOGOUT = 'LOGOUT',
    EXPORT = 'EXPORT',
    AI_ANALYSIS = 'AI_ANALYSIS',
}
