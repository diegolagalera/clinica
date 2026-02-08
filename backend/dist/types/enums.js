"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditAction = exports.PaymentMethod = exports.InvoiceStatus = exports.StockMovementType = exports.AIAnalysisStatus = exports.AppointmentStatus = exports.AppointmentType = exports.Role = void 0;
// User roles in the system
var Role;
(function (Role) {
    Role["SUPERADMIN"] = "SUPERADMIN";
    Role["ADMIN"] = "ADMIN";
    Role["WORKER"] = "WORKER";
    Role["USER"] = "USER";
})(Role || (exports.Role = Role = {}));
// Appointment types
var AppointmentType;
(function (AppointmentType) {
    AppointmentType["VISIT"] = "VISIT";
    AppointmentType["SURGERY"] = "SURGERY";
    AppointmentType["REVIEW"] = "REVIEW";
    AppointmentType["EMERGENCY"] = "EMERGENCY";
    AppointmentType["FOLLOWUP"] = "FOLLOWUP";
})(AppointmentType || (exports.AppointmentType = AppointmentType = {}));
// Appointment status
var AppointmentStatus;
(function (AppointmentStatus) {
    AppointmentStatus["SCHEDULED"] = "SCHEDULED";
    AppointmentStatus["COMPLETED"] = "COMPLETED";
    AppointmentStatus["CANCELLED"] = "CANCELLED";
    AppointmentStatus["NO_SHOW"] = "NO_SHOW";
})(AppointmentStatus || (exports.AppointmentStatus = AppointmentStatus = {}));
// Radiograph AI analysis status
var AIAnalysisStatus;
(function (AIAnalysisStatus) {
    AIAnalysisStatus["PENDING"] = "PENDING";
    AIAnalysisStatus["PROCESSING"] = "PROCESSING";
    AIAnalysisStatus["COMPLETED"] = "COMPLETED";
    AIAnalysisStatus["FAILED"] = "FAILED";
    AIAnalysisStatus["REVIEWED"] = "REVIEWED";
    AIAnalysisStatus["REJECTED"] = "REJECTED";
})(AIAnalysisStatus || (exports.AIAnalysisStatus = AIAnalysisStatus = {}));
// Stock movement types
var StockMovementType;
(function (StockMovementType) {
    StockMovementType["IN"] = "IN";
    StockMovementType["OUT"] = "OUT";
    StockMovementType["ADJUSTMENT"] = "ADJUSTMENT";
    StockMovementType["EXPIRED"] = "EXPIRED";
})(StockMovementType || (exports.StockMovementType = StockMovementType = {}));
// Invoice status
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["DRAFT"] = "DRAFT";
    InvoiceStatus["SENT"] = "SENT";
    InvoiceStatus["PAID"] = "PAID";
    InvoiceStatus["PARTIAL"] = "PARTIAL";
    InvoiceStatus["OVERDUE"] = "OVERDUE";
    InvoiceStatus["CANCELLED"] = "CANCELLED";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
// Payment methods
var PaymentMethod;
(function (PaymentMethod) {
    PaymentMethod["CASH"] = "CASH";
    PaymentMethod["CARD"] = "CARD";
    PaymentMethod["TRANSFER"] = "TRANSFER";
    PaymentMethod["INSURANCE"] = "INSURANCE";
    PaymentMethod["OTHER"] = "OTHER";
})(PaymentMethod || (exports.PaymentMethod = PaymentMethod = {}));
// Audit action types
var AuditAction;
(function (AuditAction) {
    AuditAction["CREATE"] = "CREATE";
    AuditAction["READ"] = "READ";
    AuditAction["UPDATE"] = "UPDATE";
    AuditAction["DELETE"] = "DELETE";
    AuditAction["LOGIN"] = "LOGIN";
    AuditAction["LOGOUT"] = "LOGOUT";
    AuditAction["EXPORT"] = "EXPORT";
    AuditAction["AI_ANALYSIS"] = "AI_ANALYSIS";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
//# sourceMappingURL=enums.js.map