export declare enum Role {
    SUPERADMIN = "SUPERADMIN",
    ADMIN = "ADMIN",
    WORKER = "WORKER",
    USER = "USER"
}
export declare enum AppointmentType {
    VISIT = "VISIT",
    SURGERY = "SURGERY",
    REVIEW = "REVIEW",
    EMERGENCY = "EMERGENCY",
    FOLLOWUP = "FOLLOWUP"
}
export declare enum AppointmentStatus {
    SCHEDULED = "SCHEDULED",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    NO_SHOW = "NO_SHOW"
}
export declare enum AIAnalysisStatus {
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    REVIEWED = "REVIEWED",
    REJECTED = "REJECTED"
}
export declare enum StockMovementType {
    IN = "IN",
    OUT = "OUT",
    ADJUSTMENT = "ADJUSTMENT",
    EXPIRED = "EXPIRED"
}
export declare enum InvoiceStatus {
    DRAFT = "DRAFT",
    SENT = "SENT",
    PAID = "PAID",
    PARTIAL = "PARTIAL",
    OVERDUE = "OVERDUE",
    CANCELLED = "CANCELLED"
}
export declare enum PaymentMethod {
    CASH = "CASH",
    CARD = "CARD",
    TRANSFER = "TRANSFER",
    INSURANCE = "INSURANCE",
    OTHER = "OTHER"
}
export declare enum AuditAction {
    CREATE = "CREATE",
    READ = "READ",
    UPDATE = "UPDATE",
    DELETE = "DELETE",
    LOGIN = "LOGIN",
    LOGOUT = "LOGOUT",
    EXPORT = "EXPORT",
    AI_ANALYSIS = "AI_ANALYSIS"
}
//# sourceMappingURL=enums.d.ts.map